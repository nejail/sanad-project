import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapPreview } from '../../components/MapPreview';
import { Banner, Card, IconTile, PrimaryButton, Radio, Screen, SectionLabel } from '../../components/ui';
import { Address, Coordinates } from '../../models/types';
import { ScreenProps } from '../../navigation/types';
import { DOHA, getCurrentPlace, reverseGeocode } from '../../services/location';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/** 07 Location: map, GPS "use my current location", tap the map to move the pin, or pick a saved place. */
export default function LocationView({ navigation }: ScreenProps<'Location'>) {
  const { draft, updateDraft } = useApp();
  const { addresses } = useAccount();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!draft.address) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (def) updateDraft({ address: def });
      else useCurrent();
    }
  }, []);

  const selected = draft.address;
  const center: Coordinates = selected?.coords ?? DOHA;

  async function useCurrent() {
    setLocating(true);
    setError('');
    try {
      const place = await getCurrentPlace();
      const address: Address = { id: 'current', label: 'Current location', line: place.address, coords: place.coords, isDefault: false };
      updateDraft({ address });
    } catch (e) {
      setError(`${(e as Error).message}. Pick a saved location or tap the map instead.`);
    } finally {
      setLocating(false);
    }
  }

  async function pinAt(coords: Coordinates) {
    let line = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    try {
      line = await reverseGeocode(coords);
    } catch {
      // keep coordinates
    }
    updateDraft({ address: { id: 'pin', label: 'Pinned location', line, coords, isDefault: false } });
  }

  return (
    <Screen
      title="Service Location"
      footer={<PrimaryButton label="Continue" disabled={!selected} onPress={() => navigation.navigate('Schedule')} testID="location-continue" />}
    >
      <MapPreview center={center} onPick={pinAt} height={230} />
      <SectionLabel>Address</SectionLabel>
      <View style={styles.address}>
        <Ionicons name="location-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.text, flex: 1 }} numberOfLines={2} testID="selected-address">
          {selected ? selected.line : 'No location selected'}
        </Text>
      </View>
      <Pressable style={styles.gps} onPress={useCurrent} disabled={locating} testID="use-current-location">
        {locating ? <ActivityIndicator color={colors.primary} size="small" /> : <Ionicons name="locate-outline" size={18} color={colors.primary} />}
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{locating ? 'Finding you…' : 'Use My Current Location'}</Text>
      </Pressable>
      {error ? <Banner tone="danger" text={error} /> : null}
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
