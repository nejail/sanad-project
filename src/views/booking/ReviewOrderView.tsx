import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, OptionRow, PriceSummary, PrimaryButton, Row, Screen, SectionLabel } from '../../components/ui';
import { getOption, getService } from '../../models/catalog';
import { buildQuote } from '../../models/pricing';
import { ScreenProps } from '../../navigation/types';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors } from '../../theme';

/** 09 Review Order */
export default function ReviewOrderView({ navigation }: ScreenProps<'ReviewOrder'>) {
  const { draft, updateDraft, placeOrder } = useApp();
  const { cars } = useAccount();
  const [promo, setPromo] = useState('');
  const [busy, setBusy] = useState(false);

  const serviceId = draft.serviceId!;
  const optionId = draft.optionId!;
  const service = getService(serviceId);
  const option = getOption(serviceId, optionId);
  const car = cars.find((c) => c.id === draft.carId);
  const quote = useMemo(
    () => buildQuote({ serviceId, optionId, addOnIds: draft.addOnIds, litres: draft.litres, distanceKm: draft.distanceKm }),
    [serviceId, optionId, draft.addOnIds, draft.litres, draft.distanceKm],
  );
  const when = draft.schedule?.kind === 'later' ? `${draft.schedule.date} · ${draft.schedule.time}` : 'Now (ASAP)';

  const place = () => {
    setBusy(true);
    try {
      const order = placeOrder();
      navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'OrderPlaced', params: { orderId: order.id } }] });
    } catch (e) {
      Alert.alert('Could not place order', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Review Order" footer={<PrimaryButton label="Place Order" onPress={place} loading={busy} testID="place-order" />}>
      <Card style={{ gap: 8 }}>
        <Row label="Service" value={`${service.shortTitle.replace(' Service', '')} ${option.title}`} />
        <Row label="Vehicle" value={car ? `${car.model} · ${car.plate}` : '-'} />
        <Row label="Location" value={draft.address?.line ?? '-'} />
        <Row label="Schedule" value={when} />
        {draft.photoUri ? <Row label="Photo" value="Attached" /> : null}
      </Card>
      <PriceSummary quote={quote} />
      <SectionLabel>Payment</SectionLabel>
      <OptionRow icon="cash-outline" title="Cash on Service" subtitle="Pay when the technician arrives" selected={draft.payment === 'cash'} onPress={() => updateDraft({ payment: 'cash' })} />
      <OptionRow icon="card-outline" title="Card Payment" subtitle="Coming soon" selected={false} disabled onPress={() => undefined} />
      <View style={styles.promo}>
        <Ionicons name="pricetag-outline" size={16} color={colors.muted} />
        <TextInput value={promo} onChangeText={setPromo} placeholder="Promo Code (Optional)" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.text }} autoCapitalize="characters" />
        <Pressable onPress={() => { updateDraft({ promo }); Alert.alert('Promo code', promo ? `"${promo}" will be checked when the order is confirmed.` : 'Enter a code first.'); }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Apply</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  promo: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12 },
});
