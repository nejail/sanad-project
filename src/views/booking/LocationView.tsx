import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapPreview } from '../../components/MapPreview';
import { Banner, Card, Field, IconTile, PrimaryButton, Radio, Screen, SectionLabel } from '../../components/ui';
import { getService } from '../../models/catalog';
import { Address, Coordinates } from '../../models/types';
import { ScreenProps } from '../../navigation/types';
import { DOHA, getCurrentPlace, reverseGeocode } from '../../services/location';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/**
 * 07 Location, now the first step after choosing a service (MVP 1 feedback).
 * Finds the driver automatically with GPS. If that fails, the driver describes where they are
 * (and can still pick a saved place or tap the map). The description is sent to the technician.
 */
export default function LocationView({ navigation }: ScreenProps<'Location'>) {
  const { draft, updateDraft } = useApp();
  const { addresses } = useAccount();
  const [locating, setLocating] = useState(false);
  const [notFound, setNotFound] = useState('');
  const service = draft.serviceId ? getService(draft.serviceId) : null;

  // Find the driver straight away; saved places are a fallback, not the default.
  useEffect(() => {
    if (!draft.address) useCurrent();
  }, []);

  const selected = draft.address;
  const center: Coordinates = selected?.coords ?? DOHA;
  const notes = draft.locationNotes ?? '';
  const canContinue = !!selected || notes.trim().length >= 3;

  /** Asks the phone for its GPS position and turns it into a street address. */
  async function useCurrent() {
    setLocating(true);
    setNotFound('');
    try {
      const place = await getCurrentPlace();
      const address: Address = { id: 'current', label: 'Current location', line: place.address, coords: place.coords, isDefault: false };
      updateDraft({ address });
    } catch (e) {
      setNotFound((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  /** Drops the pin where the driver tapped the map. */
  async function pinAt(coords: Coordinates) {
    let line = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    try {
      line = await reverseGeocode(coords);
    } catch {
      // keep coordinates
    }
    updateDraft({ address: { id: 'pin', label: 'Pinned location', line, coords, isDefault: false } });
  }

  /**
   * Saves the location (with the driver's description as the landmark) and moves on to the service.
   * Without a GPS fix or pin, the description itself becomes the address.
   */
  function next() {
    const described = notes.trim();
    const address: Address = selected
      ? { ...selected, landmark: described || selected.landmark }
      : { id: 'described', label: 'Described location', line: described, landmark: described, coords: center, isDefault: false };
    updateDraft({ address });
    if (draft.serviceId) navigation.navigate('Service', { serviceId: draft.serviceId });
  }

  return (
    <Screen
      title="Where Is Your Car?"
      footer={<PrimaryButton label="Continue" disabled={!canContinue || locating} onPress={next} testID="location-continue" />}
    >
      {service ? <Text style={font.small}>{service.title}: we use your location to send the nearest technician.</Text> : null}
      <MapPreview center={center} onPick={pinAt} height={210} />
      <View style={styles.address}>
        {locating ? <ActivityIndicator color={colors.primary} size="small" /> : <Ionicons name="location" size={18} color={colors.primary} />}
        <Text style={{ color: colors.text, flex: 1 }} numberOfLines={2} testID="selected-address">
          {locating ? 'Finding your location…' : selected ? selected.line : 'Location not found yet'}
        </Text>
      </View>
      {notFound && !selected ? (
        <Banner tone="danger" icon="alert-circle-outline" text="We couldn't find your location. Tell us where you are below, pick a saved place, or tap the map." />
      ) : null}

      <Field
        label={selected ? 'Anything that helps us find you? (optional)' : 'Where are you?'}
        value={notes}
        onChangeText={(t) => updateDraft({ locationNotes: t })}
        placeholder="e.g. Salwa Road exit 12, by the petrol station"
        testID="location-notes"
      />

      <Pressable style={styles.gps} onPress={useCurrent} disabled={locating} testID="use-current-location">
        <Ionicons name="locate-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{selected?.id === 'current' ? 'Update My Location' : 'Find My Location Again'}</Text>
      </Pressable>
      <Text style={font.small}>Tip: tap the map to drop the pin exactly where the car is.</Text>

      {addresses.length ? <SectionLabel>Saved Locations</SectionLabel> : null}
      {addresses.map((a) => (
        <Card key={a.id} selected={selected?.id === a.id} onPress={() => updateDraft({ address: a })} style={styles.row}>
          <IconTile name={a.label === 'Home' ? 'home-outline' : a.label === 'Office' ? 'business-outline' : 'location-outline'} />
          <View style={{ flex: 1 }}>
            <Text style={[font.h3, { fontSize: 15 }]}>{a.label}</Text>
            <Text style={font.small}>{a.line}</Text>
          </View>
          <Radio selected={selected?.id === a.id} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  address: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10 },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
