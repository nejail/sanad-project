import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapPreview } from '../../components/MapPreview';
import { Badge, Banner, Card, PrimaryButton, Screen } from '../../components/ui';
import { Route, fetchRoute, pointAlongPath } from '../../api/osm';
import { distanceKm, etaMinutes, formatQAR } from '../../models/pricing';
import { STATUS_STEPS, interpolate, providerStart, simulatedStatus, statusIndex } from '../../models/tracking';
import { OrderStatus } from '../../models/types';
import { ScreenProps } from '../../navigation/types';
import { QATAR_EMERGENCY, callNumber, openWhatsApp } from '../../services/contact';
import { notify } from '../../services/notifications';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/** Prototype: the provider's approach is simulated in 45 seconds so it can be demoed. */
const TRAVEL_MS = 45000;

/** 11 Track Order: live status, provider on the map, ETA, call / WhatsApp / SOS. */
export default function TrackOrderView({ navigation, route }: ScreenProps<'TrackOrder'>) {
  const { orders } = useAccount();
  const { setOrderStatus } = useApp();
  const order = orders.find((o) => o.id === route.params.orderId);
  const notified = useRef<Set<OrderStatus>>(new Set());
  const finished = order?.status === 'done' || order?.status === 'cancelled';

  const dest = order?.address.coords;
  // Provider starts at their real business (from Overpass) when known, otherwise ~3 km away.
  const start = useMemo(
    () => order?.provider.base?.coords ?? (dest ? providerStart(dest) : undefined),
    [dest?.latitude, dest?.longitude, order?.provider.base?.id],
  );

  // Real road route from the provider to the customer (OSRM); falls back to a straight line.
  const [road, setRoad] = useState<Route | null>(null);
  useEffect(() => {
    if (!start || !dest || finished) return;
    let cancelled = false;
    fetchRoute(start, dest)
      .then((r) => !cancelled && r.path.length > 1 && setRoad(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [start?.latitude, start?.longitude, dest?.latitude, dest?.longitude]);

  // Resume the simulation from the order's saved status (e.g. the demo order is already on the way).
  const offset = useRef(order?.status === 'arrived' ? TRAVEL_MS + 5000 : order?.status === 'on_the_way' ? 5000 : 0).current;
  const [elapsed, setElapsed] = useState(offset);

  useEffect(() => {
    if (finished) return;
    const begun = Date.now() - offset;
    const t = setInterval(() => setElapsed(Date.now() - begun), 1000);
    return () => clearInterval(t);
  }, [finished]);

  const sim = simulatedStatus(elapsed, TRAVEL_MS);
  const status: OrderStatus = finished ? order!.status : sim.status;
  const progress = finished ? 1 : sim.progress;
  const providerPos = road ? pointAlongPath(road.path, progress) : start && dest ? interpolate(start, dest, progress) : undefined;
  const remainingKm = providerPos && dest ? distanceKm(providerPos, dest) : 0;
  const eta =
    status === 'arrived' || status === 'done'
      ? 0
      : road
        ? Math.max(1, Math.round(road.durationMin * (1 - progress)))
        : etaMinutes(remainingKm);
  const remainingPath = road ? road.path.slice(Math.floor((road.path.length - 1) * progress)) : undefined;

  useEffect(() => {
    if (!order || finished || status === order.status) return;
    setOrderStatus(order.id, status);
    if (!notified.current.has(status)) {
      notified.current.add(status);
      if (status === 'on_the_way') notify('Technician on the way', `${order.provider.name} is heading to you. ETA ${eta} min.`);
      if (status === 'arrived') notify('Technician arrived', `${order.provider.name} has arrived at ${order.address.label}.`);
    }
  }, [status]);

  if (!order || !dest) return <Screen title="Track Order"><Text style={font.body}>Order not found.</Text></Screen>;

  const step = statusIndex(status);
  const sos = () =>
    Alert.alert('Emergency', 'Call Qatar emergency services (999)?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call 999', style: 'destructive', onPress: () => callNumber(QATAR_EMERGENCY) },
    ]);

  return (
    <Screen
      title="Track Order"
      right={
        <Pressable onPress={sos} style={styles.sos} accessibilityLabel="SOS">
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>SOS</Text>
        </Pressable>
      }
      footer={
        <>
          {status === 'arrived' ? (
            <PrimaryButton label="Mark Job as Done" onPress={() => { setOrderStatus(order.id, 'done'); notify('Job completed', `Thanks for using SANAD. Total ${formatQAR(order.quote.total)}.`); }} />
          ) : null}
          <PrimaryButton label="Back to Home" variant="secondary" onPress={() => navigation.popToTop()} />
        </>
      }
    >
      <MapPreview center={dest} provider={status === 'done' ? undefined : providerPos} route={providerPos ? (remainingPath ? [providerPos, ...remainingPath] : [providerPos, dest]) : undefined} height={240} interactive={false} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[font.h2, { fontSize: 19 }]}>
            {status === 'confirmed' ? 'Finding your technician' : status === 'on_the_way' ? 'Driver on the way' : status === 'arrived' ? 'Driver has arrived' : 'Job completed'}
          </Text>
          <Text style={font.small}>{order.title} · {order.address.label}</Text>
          {order.provider.base ? <Text style={font.small} numberOfLines={1}>From {order.provider.base.name}{road ? ` · ${road.distanceKm} km by road` : ''}</Text> : null}
          {order.towTo ? <Text style={font.small} numberOfLines={1}>Towing to {order.towTo.name} ({order.towTo.distanceKm} km)</Text> : null}
        </View>
        {status === 'on_the_way' || status === 'confirmed' ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '800' }}>{eta} min</Text>
            <Text style={font.small}>ETA</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.steps}>
        {STATUS_STEPS.map((s, i) => (
          <View key={s.key} style={{ flex: 1, gap: 6 }}>
            <View style={[styles.bar, i <= step && { backgroundColor: colors.primary }]} />
            <Text style={{ fontSize: 11, color: i <= step ? colors.primary : colors.muted, fontWeight: i === step ? '700' : '500' }}>{s.label}</Text>
          </View>
        ))}
      </View>
      <Card style={styles.provider}>
        <View style={styles.avatar}><Text style={{ color: '#fff', fontWeight: '800' }}>{order.provider.name[0]}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[font.h3, { fontSize: 15 }]}>{order.provider.name}</Text>
          <Text style={font.small}>★ {order.provider.rating} · {order.provider.vehicle}</Text>
        </View>
        <Pressable style={[styles.round, { backgroundColor: colors.primary }]} onPress={() => callNumber(order.provider.phone)} accessibilityLabel="Call provider">
          <Ionicons name="call" size={18} color="#fff" />
        </Pressable>
        <Pressable style={styles.round} onPress={() => openWhatsApp(order.provider.phone, `Hi, this is about SANAD order #${order.id}.`)} accessibilityLabel="Message provider on WhatsApp">
          <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
        </Pressable>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={font.small}>Order #{order.id} · {formatQAR(order.quote.total)} · {order.payment === 'cash' ? 'Cash' : 'Card'}</Text>
        {status === 'done' ? <Badge label="Done" tone="success" /> : null}
      </View>
      {!finished ? <Banner text={`Prototype: the provider's movement is sped up so the trip takes under a minute${road ? '; the path follows the real road route' : ''}.`} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sos: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  head: { flexDirection: 'row', alignItems: 'center' },
  steps: { flexDirection: 'row', gap: 6 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  provider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  round: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
});
