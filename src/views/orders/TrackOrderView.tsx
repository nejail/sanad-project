import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapPreview } from '../../components/MapPreview';
import { Badge, Banner, Card, PrimaryButton, Screen } from '../../components/ui';
import { Route, fetchRoute, pointAlongPath } from '../../api/osm';
import { isFresh, pathFrom } from '../../models/liveTracking';
import { distanceKm, etaMinutes, formatQAR } from '../../models/pricing';
import {
  STATUS_STEPS, interpolate, isSimulated, providerProgress, providerStart, showsDemoBadge, simulatedStatus, simulationOffset, statusIndex, trackingTitle,
} from '../../models/tracking';
import { OrderStatus } from '../../models/types';
import { ScreenProps } from '../../navigation/types';
import { QATAR_EMERGENCY, callNumber, openWhatsApp } from '../../services/contact';
import { notify } from '../../services/notifications';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { useLiveTracking } from '../../viewModels/useLiveTracking';
import { colors, font } from '../../theme';

/** Prototype: the provider's approach is simulated in 45 seconds so it can be demoed. */
const TRAVEL_MS = 45000;

const timeLabel = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');

/**
 * 11 Track Order: status, provider on the map, ETA, call / WhatsApp / SOS.
 * Simulated orders move along by themselves; orders sent to Provider Mode follow the status the
 * technician sets. Acceptance is shown explicitly with the technician's details (V2 feature 6), and
 * a "Demo Mode" badge marks the simulated van movement (feature 10). Orders taken by a real
 * technician in the development build follow the technician's live location instead (feature 7).
 */
export default function TrackOrderView({ navigation, route }: ScreenProps<'TrackOrder'>) {
  const { orders } = useAccount();
  const { setOrderStatus, providerTestMode, dataSource } = useApp();
  const order = orders.find((o) => o.id === route.params.orderId);
  const finished = order?.status === 'done' || order?.status === 'cancelled';
  const simulated = order ? isSimulated(order) : true;
  // The technician's real position while they drive to the driver (V2 feature 7).
  const live = useLiveTracking(order);

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
  const offset = useRef(order ? simulationOffset(order.status, TRAVEL_MS) : 0).current;
  const [elapsed, setElapsed] = useState(offset);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (finished) return;
    const begun = Date.now() - offset;
    const t = setInterval(() => {
      setElapsed(Date.now() - begun);
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [finished]);

  const sim = simulatedStatus(elapsed, TRAVEL_MS);
  const status: OrderStatus = !order ? 'confirmed' : finished || !simulated ? order.status : sim.status;
  // Live position when the technician is on the way and it is recent; the animation otherwise.
  const liveFix = !simulated && status === 'on_the_way' && isFresh(live, now) ? live : null;
  const progress = finished ? 1 : simulated ? sim.progress : order ? providerProgress(order.status, order.statusHistory, now, TRAVEL_MS) : 0;
  const providerPos = liveFix
    ? liveFix.coords
    : road ? pointAlongPath(road.path, progress) : start && dest ? interpolate(start, dest, progress) : undefined;
  const remainingKm = providerPos && dest ? distanceKm(providerPos, dest) : 0;
  const eta =
    status === 'arrived' || status === 'done'
      ? 0
      : liveFix
        ? liveFix.etaMin ?? etaMinutes(remainingKm)
        : road
          ? Math.max(1, Math.round(road.durationMin * (1 - progress)))
          : etaMinutes(remainingKm);
  const remainingPath = liveFix
    ? road ? pathFrom(road.path, liveFix.coords) : undefined
    : road ? road.path.slice(Math.floor((road.path.length - 1) * progress)) : undefined;
  // Demo Mode: simulated orders, and Provider Mode tested on one phone (no live location there).
  const demo = !!order && (showsDemoBadge(order) || (!simulated && dataSource !== 'firestore'));

  // Simulated orders: save each new status (notifications are shown by OrderStatusWatcher for every order).
  useEffect(() => {
    if (!order || finished || !simulated || status === order.status) return;
    setOrderStatus(order.id, status);
  }, [status]);

  if (!order || !dest) return <Screen title="Track Order"><Text style={font.body}>Order not found.</Text></Screen>;

  const step = statusIndex(status);
  const waiting = status === 'confirmed';
  const p = order.provider;
  const sos = () =>
    Alert.alert('Emergency', 'Call Qatar emergency services (999)?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call 999', style: 'destructive', onPress: () => callNumber(QATAR_EMERGENCY) },
    ]);

  return (
    <Screen
      title="Track Order"
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {demo && !finished ? (
            <View style={styles.demo} testID="demo-mode-badge" accessibilityLabel="Demo Mode: the technician's movement is simulated">
              <Ionicons name="flask-outline" size={12} color={colors.price} />
              <Text style={{ color: colors.price, fontWeight: '800', fontSize: 11 }}>DEMO MODE</Text>
            </View>
          ) : null}
          <Pressable onPress={sos} style={styles.sos} accessibilityLabel="SOS">
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>SOS</Text>
          </Pressable>
        </View>
      }
      footer={
        <>
          {status === 'arrived' && simulated ? (
            <PrimaryButton label="Mark Job as Done" onPress={() => { setOrderStatus(order.id, 'done'); notify('Job completed', `Thanks for using SANAD. Total ${formatQAR(order.quote.total)}.`); }} />
          ) : null}
          <PrimaryButton label="Back to Home" variant="secondary" onPress={() => navigation.popToTop()} />
        </>
      }
    >
      <MapPreview center={dest} provider={status === 'done' || waiting ? undefined : providerPos} route={!waiting && providerPos ? (remainingPath ? [providerPos, ...remainingPath] : [providerPos, dest]) : undefined} height={240} interactive={false} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[font.h2, { fontSize: 19 }]} testID="tracking-title">{trackingTitle(status)}</Text>
          <Text style={font.small}>{order.title} · {order.address.label}</Text>
          {liveFix ? (
            <Text style={[font.small, { color: colors.success }]} testID="live-location">Live location · {remainingKm.toFixed(1)} km away</Text>
          ) : p.base && !waiting ? <Text style={font.small} numberOfLines={1}>From {p.base.name}{road ? ` · ${road.distanceKm} km by road` : ''}</Text> : null}
          {order.towTo ? <Text style={font.small} numberOfLines={1}>Towing to {order.towTo.name} ({order.towTo.distanceKm} km)</Text> : null}
        </View>
        {status === 'on_the_way' || status === 'accepted' ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '800' }}>{eta} min</Text>
            <Text style={font.small}>ETA</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.steps}>
        {STATUS_STEPS.map((s, i) => (
          <View key={s.key} style={{ flex: 1, gap: 6 }}>
            <View style={[styles.bar, i <= step && { backgroundColor: s.key === 'accepted' && i === step ? colors.success : colors.primary }]} />
            <Text style={{ fontSize: 11, color: i <= step ? colors.primary : colors.muted, fontWeight: i === step ? '700' : '500' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {waiting ? (
        <Card style={styles.waiting} testID="waiting-for-acceptance">
          <ActivityIndicator color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Not accepted yet</Text>
            <Text style={font.small}>
              Your request was sent to technicians nearby. This screen and a notification will tell you as soon as one accepts.
            </Text>
            {!simulated && providerTestMode ? (
              <Text style={[font.small, { color: colors.price }]}>Testing on one phone: open Profile, then Provider Mode, to accept it.</Text>
            ) : null}
          </View>
        </Card>
      ) : (
        <>
          {status === 'accepted' ? (
            <View style={styles.accepted} testID="accepted-confirmation">
              <Ionicons name="checkmark-circle" size={26} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Accepted by {p.name}</Text>
                <Text style={font.small}>
                  {order.acceptedAt ? `At ${timeLabel(order.acceptedAt)}. ` : ''}They are getting ready to come to you.
                </Text>
              </View>
            </View>
          ) : null}
          <Card style={{ gap: 12 }}>
            <View style={styles.provider}>
              <View style={styles.avatar}><Text style={{ color: '#fff', fontWeight: '800' }}>{p.name[0]}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[font.h3, { fontSize: 15, flexShrink: 1 }]} numberOfLines={1}>{p.name}</Text>
                  {p.verified ? <Ionicons name="shield-checkmark" size={15} color={colors.success} accessibilityLabel="Verified technician" /> : null}
                </View>
                <Text style={font.small}>{p.rating ? `★ ${p.rating} · ` : ''}{p.vehicle}{p.vehiclePlate ? ` · Plate ${p.vehiclePlate}` : ''}</Text>
                {p.verified ? <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>Verified technician</Text> : null}
              </View>
              <Pressable style={[styles.round, { backgroundColor: colors.primary }]} onPress={() => callNumber(p.phone)} accessibilityLabel="Call provider">
                <Ionicons name="call" size={18} color="#fff" />
              </Pressable>
              <Pressable style={styles.round} onPress={() => openWhatsApp(p.phone, `Hi, this is about SANAD order #${order.id}.`)} accessibilityLabel="Message provider on WhatsApp">
                <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
              </Pressable>
            </View>
            {status !== 'accepted' && order.acceptedAt ? <Text style={font.small}>Accepted at {timeLabel(order.acceptedAt)}</Text> : null}
          </Card>
        </>
      )}

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={font.small}>Order #{order.id} · {formatQAR(order.quote.total)} · {order.payment === 'cash' ? 'Cash' : 'Card'}</Text>
        {status === 'done' ? <Badge label="Done" tone="success" /> : null}
      </View>
      {!finished && demo ? (
        <Banner
          icon="flask-outline"
          text={simulated
            ? `Demo Mode: the technician and their movement are simulated, and the trip is sped up to under a minute${road ? '; the path follows the real road route' : ''}.`
            : `Demo Mode: the status comes from the technician, but the van's movement on the map is simulated until live tracking is ready.`}
        />
      ) : null}
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
  demo: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.price, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(245,165,36,0.12)' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accepted: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.success, backgroundColor: colors.successSoft },
  round: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
});
