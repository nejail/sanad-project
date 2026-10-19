import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, IconTile, PrimaryButton, Radio, Screen } from '../../components/ui';
import { ScreenProps } from '../../navigation/types';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/** 05 Select Vehicle */
export default function SelectVehicleView({ navigation }: ScreenProps<'SelectVehicle'>) {
  const { draft, updateDraft } = useApp();
  const { cars } = useAccount();

  useEffect(() => {
    if (!draft.carId && cars.length) updateDraft({ carId: (cars.find((c) => c.isDefault) ?? cars[0]).id });
  }, [cars.length]);

  return (
    <Screen
      title="Select Vehicle"
      footer={<PrimaryButton label="Continue" disabled={!draft.carId} onPress={() => navigation.navigate('Location')} testID="vehicle-continue" />}
    >
      {cars.map((c) => (
        <Card key={c.id} selected={draft.carId === c.id} onPress={() => updateDraft({ carId: c.id })} style={styles.row} testID="vehicle-row">
          <IconTile name="car-outline" />
          <View style={{ flex: 1 }}>
            <Text style={[font.h3, { fontSize: 15 }]}>{c.make} {c.model}</Text>
            <Text style={font.small}>{c.year} · {c.color} · {c.plate}</Text>
          </View>
          <Radio selected={draft.carId === c.id} />
        </Card>
      ))}
      <Pressable style={styles.add} onPress={() => navigation.navigate('AddCar', { fromBooking: true })}>
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Add New Vehicle</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  add: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary },
});
