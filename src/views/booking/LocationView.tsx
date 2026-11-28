import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { geocode } from '../../api/osm';
import { MapPreview } from '../../components/MapPreview';
import { Banner, Card, Field, IconTile, LinkText, PrimaryButton, Radio, Screen, SectionLabel } from '../../components/ui';
import { getService } from '../../models/catalog';
import { pinnedCoords } from '../../models/location';
import { Address, Coordinates } from '../../models/types';
import { ScreenProps } from '../../navigation/types';
import { DOHA, getCurrentPlace, reverseGeocode } from '../../services/location';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/**
 * 07 Location, now the first step after choosing a service (MVP 1 feedback).
 * Finds the driver automatically with GPS. If that fails, the driver describes where they are
 * (and can still pick a saved place or tap the map). The description is sent to the technician.
 * When GPS fails, a large "Enter Location Manually" button opens the description field (V2 feature 2).
 * The description is looked up on the map and the driver checks the pin; when it is not found, the
 * driver taps the map, so every order has a real position for the price, matching and tracking.
 */
export default function LocationView({ navigation }: ScreenProps<'Location'>) {
  const { draft, updateDraft } = useApp();
  const { addresses } = useAccount();
  const [locating, setLocating] = useState(false);
  const [notFound, setNotFound] = useState('');
  // The driver chose to type where they are (Sprint 5: 3 of 10 missed this option when GPS failed).
  const [manual, setManual] = useState(false);
  // Looking up the typed location, the text that was looked up, and why it has no pin yet.
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState('');
  const [needsPin, setNeedsPin] = useState('');
  // Counts location changes, so a slow search never moves a pin the driver dropped meanwhile.
  const changes = useRef(0);
  const service = draft.serviceId ? getService(draft.serviceId) : null;

  // Find the driver straight away; saved places are a fallback, not the default.
  useEffect(() => {
    if (!selected) useCurrent();
  }, []);

  const selected = pinnedCoords(draft.address) ? draft.address : undefined;
  const center: Coordinates = selected?.coords ?? DOHA;
  const notes = draft.locationNotes ?? '';
  const canContinue = !!selected || notes.trim().length >= 3;
  const fromText = selected?.id === 'searched';
  const gpsFailed = !locating && !selected && !!notFound;

  /** Changes where the car is. The garage, distance and provider found for the old place no longer apply. */
  function setAddress(address: Address) {
    changes.current += 1;
    setNeedsPin('');
    updateDraft({ address, towTo: undefined, distanceKm: undefined, providerBase: undefined });
  }

  /** Asks the phone for its GPS position and turns it into a street address. */
  async function useCurrent() {
    setLocating(true);
    setNotFound('');
    try {
      const place = await getCurrentPlace();
      const address: Address = { id: 'current', label: 'Current location', line: place.address, coords: place.coords, isDefault: false };
      setAddress(address);
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
    setAddress({ id: 'pin', label: 'Pinned location', line, coords, isDefault: false });
  }

  /** Looks up the typed location and drops the pin there for the driver to check. */
  async function search() {
    const text = notes.trim();
    const before = changes.current;
    setSearching(true);
    setNeedsPin('');
    try {
      const found = await geocode(text);
      if (changes.current !== before) return;
      if (found) {
        setSearched(text);
        setAddress({ id: 'searched', label: 'Described location', line: found.name, coords: found.coords, isDefault: false });
      } else {
        setNeedsPin("We couldn't find that place. Tap the map where your car is, and we'll send your description too.");
      }
    } catch {
      if (changes.current !== before) return;
      setNeedsPin("We couldn't search for that place. Tap the map where your car is, and we'll send your description too.");
    } finally {
      setSearching(false);
    }
  }

  /**
   * Saves the location (with the driver's description as the landmark) and moves on to the service.
   * Without a GPS fix or pin, the description is looked up first and the driver checks the pin.
   */
  function next() {
    if (!selected) {
      search();
      return;
    }
    const described = notes.trim();
    updateDraft({ address: { ...selected, landmark: described || selected.landmark } });
    if (draft.serviceId) navigation.navigate('Service', { serviceId: draft.serviceId });
  }

  return (
    <Screen
      title="Where Is Your Car?"
      footer={<PrimaryButton label={!selected && canContinue ? 'Find on Map' : 'Continue'} disabled={!canContinue || locating} loading={searching} onPress={next} testID="location-continue" />}
    >
      {service ? <Text style={font.small}>{service.title}: we use your location to send the nearest technician.</Text> : null}
      {gpsFailed ? (
        <>
          <Banner tone="danger" icon="alert-circle-outline" text="We couldn't find your location. Type where you are, pick a saved place, or tap the map." />
          {!manual ? (
            <PrimaryButton label="Enter Location Manually" icon="create-outline" onPress={() => setManual(true)} testID="enter-location-manually" />
          ) : null}
        </>
      ) : null}
      {gpsFailed && manual ? (
        <Field
          key="manual"
          label="Where is your car?"
          value={notes}
          onChangeText={(t) => updateDraft({ locationNotes: t })}
          placeholder="e.g. Salwa Road exit 12, by the petrol station"
          autoFocus
          returnKeyType="done"
          testID="location-manual"
        />
      ) : null}
      {needsPin ? <Banner tone="danger" icon="location-outline" text={needsPin} /> : null}
      {fromText ? (
        <>
          <Banner icon="location-outline" text={`We placed the pin at ${selected?.line}. If that is not where your car is, tap the map to move it, then continue.`} />
          {notes.trim().length >= 3 && notes.trim() !== searched ? <LinkText label="Search again with the new text" onPress={search} /> : null}
        </>
      ) : null}
      <MapPreview center={center} onPick={pinAt} height={gpsFailed ? 160 : 210} />
      <View style={styles.address}>
        {locating ? <ActivityIndicator color={colors.primary} size="small" /> : <Ionicons name="location" size={18} color={colors.primary} />}
        <Text style={{ color: colors.text, flex: 1 }} numberOfLines={2} testID="selected-address">
          {locating ? 'Finding your location…' : selected ? selected.line : 'Location not found yet'}
        </Text>
      </View>
      {gpsFailed && manual ? null : (
        <Field
          label={selected ? 'Anything that helps us find you? (optional)' : 'Where are you?'}
          value={notes}
          onChangeText={(t) => updateDraft({ locationNotes: t })}
          placeholder="e.g. Salwa Road exit 12, by the petrol station"
          testID="location-notes"
        />
      )}

      <Pressable style={styles.gps} onPress={useCurrent} disabled={locating} testID="use-current-location">
        <Ionicons name="locate-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{selected?.id === 'current' ? 'Update My Location' : 'Find My Location Again'}</Text>
      </Pressable>
      <Text style={font.small}>Tip: tap the map to drop the pin exactly where the car is.</Text>

      {addresses.length ? <SectionLabel>Saved Locations</SectionLabel> : null}
      {addresses.map((a) => (
        <Card key={a.id} selected={selected?.id === a.id} onPress={() => setAddress(a)} style={styles.row}>
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
