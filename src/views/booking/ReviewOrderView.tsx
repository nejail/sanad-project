import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Card, IconTile, LinkText, OptionRow, PriceSummary, PrimaryButton, Radio, Row, Screen, SectionLabel } from '../../components/ui';
import { SERVICE_PLACE_KIND, fetchRoute } from '../../api/osm';
import { orderTitle } from '../../models/catalog';
import { frequentGarages, usedGarageLabel } from '../../models/garages';
import { buildQuote, distanceKm as straightKm, isFirstWashFree } from '../../models/pricing';
import { PlaceRef } from '../../models/types';
import { ScreenProps } from '../../navigation/types';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { useNearbyPlaces } from '../../viewModels/useNearbyPlaces';
import { colors, font } from '../../theme';

/**
 * 09 Review Order. Also shows the nearest real provider (Overpass + OSRM). For towing, the garage
 * nearest to the driver by road is chosen automatically; garages used before are quick alternatives.
 */
export default function ReviewOrderView({ navigation }: ScreenProps<'ReviewOrder'>) {
  const { draft, updateDraft, placeOrder } = useApp();
  const { cars, orders } = useAccount();
  const firstWashFree = draft.serviceId === 'carwash' && isFirstWashFree(orders);
  const [promo, setPromo] = useState('');
  const [busy, setBusy] = useState(false);

  const serviceId = draft.serviceId!;
  const optionId = draft.optionId!;
  const car = cars.find((c) => c.id === draft.carId);
  const towing = serviceId === 'emergency' && optionId === 'towing';
  const center = draft.address?.coords;

  // Nearest business that can do this service, with driving time to the customer.
  const providers = useNearbyPlaces(center, SERVICE_PLACE_KIND[serviceId], { limit: 3, withRoutes: 1, direction: 'toCustomer' });
  // For towing: the closest garages with the real driving distance, so the nearest by road can be chosen.
  const garages = useNearbyPlaces(center, 'garage', { limit: 3, withRoutes: 3, direction: 'fromCustomer', enabled: towing });
  const nearestGarage = useMemo(
    () => [...garages.places].sort((a, b) => (a.route?.distanceKm ?? a.distanceKm) - (b.route?.distanceKm ?? b.distanceKm))[0],
    [garages.places],
  );
  // Garages this driver towed to before, most used first (student feedback).
  const usedGarages = useMemo(() => frequentGarages(orders).filter((g) => g.id !== nearestGarage?.id), [orders, nearestGarage?.id]);
  const [routing, setRouting] = useState(false);

  const nearest = providers.places[0];
  useEffect(() => {
    if (nearest) {
      updateDraft({
        providerBase: { id: nearest.id, name: nearest.name, coords: nearest.coords, phone: nearest.phone, etaMin: nearest.route?.durationMin },
      });
    }
  }, [nearest?.id, nearest?.route?.durationMin]);

  // Choose the nearest garage automatically once it is known.
  useEffect(() => {
    if (towing && nearestGarage && !draft.towTo) chooseNearest();
  }, [nearestGarage?.id]);

  /** Tows to the nearest garage, priced by its road distance. */
  function chooseNearest() {
    const g = nearestGarage;
    if (!g) return;
    const km = g.route?.distanceKm ?? g.distanceKm;
    updateDraft({ towTo: { id: g.id, name: g.name, coords: g.coords, phone: g.phone, distanceKm: km }, distanceKm: km });
  }

  /** Tows to a garage used before; asks OSRM for the road distance (straight line if that fails). */
  async function chooseUsed(g: PlaceRef) {
    if (!center) return;
    setRouting(true);
    let km = Math.round(straightKm(center, g.coords) * 10) / 10;
    try {
      km = (await fetchRoute(center, g.coords)).distanceKm;
    } catch {
      // keep the straight-line distance
    }
    updateDraft({ towTo: { id: g.id, name: g.name, coords: g.coords, phone: g.phone, distanceKm: km }, distanceKm: km });
    setRouting(false);
  }

  const quote = useMemo(
    () => buildQuote({ serviceId, optionId, addOnIds: draft.addOnIds, litres: draft.litres, distanceKm: draft.distanceKm, firstWashFree }),
    [serviceId, optionId, draft.addOnIds, draft.litres, draft.distanceKm, firstWashFree],
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
        <Row label="Service" value={orderTitle(serviceId, optionId)} />
        <Row label="Vehicle" value={car ? `${car.model} · ${car.plate}` : '-'} />
        <Row label="Location" value={draft.address?.line ?? '-'} />
        {draft.address?.landmark && draft.address.landmark !== draft.address.line ? <Row label="Directions" value={draft.address.landmark} /> : null}
        <Row label="Schedule" value={when} />
        {draft.photoUri ? <Row label="Photo" value="Attached" /> : null}
      </Card>

      <SectionLabel>Nearest provider</SectionLabel>
      {providers.loading ? (
        <Loading text="Finding providers near you…" />
      ) : nearest ? (
        <Card style={styles.row} testID="nearest-provider">
          <IconTile name="business-outline" />
          <View style={{ flex: 1 }}>
            <Text style={[font.h3, { fontSize: 15 }]} numberOfLines={1}>{nearest.name}</Text>
            <Text style={font.small}>
              {nearest.route ? `${nearest.route.distanceKm} km away by road · about ${nearest.route.durationMin} min` : `${nearest.distanceKm} km away`}
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <Banner
            tone={providers.error ? 'danger' : 'info'}
            text={providers.error ? `Couldn't load nearby providers (${providers.error}). One will be assigned after you order.` : 'No providers found nearby. One will be assigned after you order.'}
          />
          {providers.error ? <LinkText label="Try again" onPress={providers.retry} /> : null}
        </>
      )}

      {towing ? (
        <>
          <SectionLabel>Tow to</SectionLabel>
          {garages.loading ? <Loading text="Finding the garage nearest to you…" /> : null}
          {nearestGarage ? (
            <Card selected={draft.towTo?.id === nearestGarage.id} onPress={chooseNearest} style={styles.row} testID="tow-garage">
              <IconTile name="construct-outline" />
              <View style={{ flex: 1 }}>
                <Text style={[font.h3, { fontSize: 15 }]} numberOfLines={1}>{nearestGarage.name}</Text>
                <Text style={font.small}>Nearest garage · {nearestGarage.route ? `${nearestGarage.route.distanceKm} km by road` : `${nearestGarage.distanceKm} km`}</Text>
              </View>
              <Radio selected={draft.towTo?.id === nearestGarage.id} />
            </Card>
          ) : null}
          {usedGarages.length ? <Text style={font.small}>Your garages</Text> : null}
          {usedGarages.map((g) => (
            <Card key={g.id} selected={draft.towTo?.id === g.id} onPress={() => chooseUsed(g)} style={styles.row} testID="used-garage">
              <IconTile name="time-outline" />
              <View style={{ flex: 1 }}>
                <Text style={[font.h3, { fontSize: 15 }]} numberOfLines={1}>{g.name}</Text>
                <Text style={font.small}>{usedGarageLabel(g)}{draft.towTo?.id === g.id ? ` · ${draft.towTo.distanceKm} km` : ''}</Text>
              </View>
              <Radio selected={draft.towTo?.id === g.id} />
            </Card>
          ))}
          {routing ? <Loading text="Checking the road distance…" /> : null}
          {!garages.loading && !nearestGarage ? (
            <>
              <Banner tone="danger" text={`Couldn't find a garage near you${garages.error ? ` (${garages.error})` : ''}. The price shows the base fee; the distance is added when the tow is assigned.`} />
              <LinkText label="Try again" onPress={garages.retry} />
            </>
          ) : null}
        </>
      ) : null}

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

function Loading({ text }: { text: string }) {
  return (
    <View style={[styles.row, { paddingVertical: 8 }]}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={font.small}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promo: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12 },
});
