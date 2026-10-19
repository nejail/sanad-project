import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Chip, Field, PrimaryButton, Screen, SectionLabel } from '../../components/ui';
import { isValidPlate, isValidYear, normalizePlate } from '../../models/validation';
import { ScreenProps } from '../../navigation/types';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors } from '../../theme';

const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Gold'];
const FUELS = ['Super 91', 'Premium 95', 'Diesel', 'Electric'];

/** 06 Add Car and 02d Add Your First Car (same form, different title and next step). */
export default function AddCarView({ navigation, route }: ScreenProps<'AddFirstCar' | 'AddCar'>) {
  const { addCar, updateDraft } = useApp();
  const { cars, user } = useAccount();
  const first = route.name === 'AddFirstCar';
  const fromBooking = route.name === 'AddCar' && route.params?.fromBooking;

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('White');
  const [fuel, setFuel] = useState('Super 91');
  const [isDefault, setIsDefault] = useState(true);
  const [touched, setTouched] = useState(false);

  const errors = {
    make: make.trim() ? undefined : 'Required',
    model: model.trim() ? undefined : 'Required',
    year: isValidYear(year) ? undefined : 'Enter a valid year',
    plate: isValidPlate(plate) ? undefined : 'Enter the plate number',
  };
  const valid = !Object.values(errors).some(Boolean);

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const id = addCar({
      make: make.trim(), model: model.trim(), year, plate: normalizePlate(plate), color,
      fuel: fuel === 'Electric' ? 'Electric' : fuel === 'Diesel' ? 'Diesel' : 'Gasoline',
      isDefault: isDefault || cars.length === 0, lastService: 'No services yet',
    });
    if (first) {
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } else {
      if (fromBooking) updateDraft({ carId: id });
      navigation.goBack();
    }
  };

  return (
    <Screen
      title={first ? 'Add Your First Car' : 'Add New Car'}
      back={!first}
      footer={<PrimaryButton label={first ? 'Add Car and Continue' : 'Add Car'} onPress={save} testID="add-car" />}
    >
      {first ? <Banner icon="car-sport-outline" text={`Welcome ${user.name}! Add your car so we know what we're servicing.`} /> : null}
      <View style={styles.grid}>
        <Field style={styles.half} label="Make" value={make} onChangeText={setMake} placeholder="Toyota" error={touched ? errors.make : undefined} testID="car-make" />
        <Field style={styles.half} label="Model" value={model} onChangeText={setModel} placeholder="Land Cruiser" error={touched ? errors.model : undefined} testID="car-model" />
      </View>
      <View style={styles.grid}>
        <Field style={styles.half} label="Year" value={year} onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))} placeholder="2023" keyboardType="number-pad" error={touched ? errors.year : undefined} testID="car-year" />
        <Field style={styles.half} label="License Plate" value={plate} onChangeText={(t) => setPlate(normalizePlate(t))} placeholder="QA-1234" keyboardType="number-pad" error={touched ? errors.plate : undefined} testID="car-plate" />
      </View>
      <SectionLabel>Color</SectionLabel>
      <View style={styles.chips}>
        {COLORS.map((c) => <Chip key={c} label={c} selected={color === c} onPress={() => setColor(c)} />)}
      </View>
      <SectionLabel>Fuel Type</SectionLabel>
      <View style={styles.chips}>
        {FUELS.map((f) => <Chip key={f} label={f} selected={fuel === f} onPress={() => setFuel(f)} />)}
      </View>
      <Pressable style={styles.check} onPress={() => setIsDefault((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: isDefault }}>
        <View style={[styles.box, isDefault && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          {isDefault ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
        <Text style={{ color: colors.subtext }}>Set as my default car</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
});
