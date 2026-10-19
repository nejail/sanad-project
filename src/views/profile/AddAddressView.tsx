import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Chip, Field, PrimaryButton, Screen, SectionLabel } from '../../components/ui';
import { Coordinates } from '../../models/types';
import { ScreenProps } from '../../navigation/types';
import { DOHA, getCurrentPlace } from '../../services/location';
import { useApp } from '../../viewModels/AppContext';
import { colors } from '../../theme';

/** 16 Add Address */
export default function AddAddressView({ navigation }: ScreenProps<'AddAddress'>) {
  const { addAddress } = useApp();
  const [label, setLabel] = useState<'Home' | 'Office' | 'Other'>('Home');
  const [line, setLine] = useState('');
  const [landmark, setLandmark] = useState('');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const locate = async () => {
    setLocating(true);
    setError('');
    try {
      const place = await getCurrentPlace();
      setCoords(place.coords);
      setLine(place.address);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    if (!line.trim()) {
      setError('Enter the address or use your current location.');
      return;
    }
    addAddress({ label, line: line.trim(), landmark: landmark.trim() || undefined, coords: coords ?? DOHA, isDefault });
    navigation.goBack();
  };

  return (
    <Screen title="Add New Address" footer={<PrimaryButton label="Add Address" onPress={save} testID="save-address" />}>
      <SectionLabel>Label</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['Home', 'Office', 'Other'] as const).map((l) => <Chip key={l} label={l} selected={label === l} onPress={() => setLabel(l)} />)}
      </View>
      <Field label="Address" value={line} onChangeText={setLine} placeholder="Enter full address" />
      <Pressable style={styles.gps} onPress={locate} disabled={locating}>
        {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate-outline" size={18} color={colors.primary} />}
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Use My Current Location</Text>
      </Pressable>
      {error ? <Banner tone="danger" text={error} /> : null}
      <Field label="Landmark (optional)" value={landmark} onChangeText={setLandmark} placeholder="e.g. next to the petrol station" />
      <Pressable style={styles.gps} onPress={() => setIsDefault((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: isDefault }}>
        <Ionicons name={isDefault ? 'checkbox' : 'square-outline'} size={20} color={isDefault ? colors.primary : colors.muted} />
        <Text style={{ color: colors.subtext }}>Set as default</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gps: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
