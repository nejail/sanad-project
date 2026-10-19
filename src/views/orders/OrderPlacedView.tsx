import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, PrimaryButton, Row, Screen } from '../../components/ui';
import { formatQAR } from '../../models/pricing';
import { ScreenProps } from '../../navigation/types';
import { notify } from '../../services/notifications';
import { useAccount } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/** 10 Order Placed */
export default function OrderPlacedView({ navigation, route }: ScreenProps<'OrderPlaced'>) {
  const { orders } = useAccount();
  const order = orders.find((o) => o.id === route.params.orderId);

  useEffect(() => {
    if (order) notify('Order placed', `#${order.id} ${order.title}. Your technician will be notified shortly.`);
  }, []);

  if (!order) return <Screen title="Order"><Text style={font.body}>Order not found.</Text></Screen>;
  const eta = order.schedule.kind === 'asap' ? 'Within 30 min' : `${order.schedule.date}, ${order.schedule.time}`;

  return (
    <Screen
      footer={
        <>
          <PrimaryButton label="Track Order" onPress={() => navigation.replace('TrackOrder', { orderId: order.id })} testID="track-order" />
          <PrimaryButton label="Back to Home" variant="secondary" onPress={() => navigation.popToTop()} />
        </>
      }
    >
      <View style={styles.hero}>
        <View style={styles.check}>
          <Ionicons name="checkmark" size={36} color={colors.success} />
        </View>
        <Text style={[font.title, { fontSize: 26 }]}>Order Placed!</Text>
        <Text style={font.body}>Your technician will be notified shortly</Text>
      </View>
      <Card style={{ gap: 10 }}>
        <Row label="Order ID" value={`#${order.id}`} />
        <Row label="Service" value={order.title} />
        <Row label="Estimated Arrival" value={eta} />
        <Row label="Total" value={formatQAR(order.quote.total)} strong />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, marginTop: 60, marginBottom: 12 },
  check: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
});
