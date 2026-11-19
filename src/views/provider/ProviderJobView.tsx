import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapPreview } from '../../components/MapPreview';
import { Badge, Banner, Card, IconName, PrimaryButton, Row, Screen, SectionLabel } from '../../components/ui';
import { nextProviderStep } from '../../models/providerJobs';
import { formatQAR } from '../../models/pricing';
import { STATUS_LABEL } from '../../models/tracking';
import { formatPhone } from '../../models/validation';
import { ScreenProps } from '../../navigation/types';
import { callNumber, openWhatsApp } from '../../services/contact';
import { useProviderJobs } from '../../viewModels/useProviderJobs';
import { useShareLocation } from '../../viewModels/useShareLocation';
import { colors, font } from '../../theme';

/**
 * Provider Mode job: everything the technician needs to find the driver (map, directions, car,
 * photo), then one button for each step: Accept, Start Driving, I've Arrived, Mark Job as Done.
 */
export default function ProviderJobView({ navigation, route }: ScreenProps<'ProviderJob'>) {
  const jobs = useProviderJobs();
  const order = jobs.find(route.params.orderId);
  const [busy, setBusy] = useState(false);
  const location = useShareLocation(order); // live tracking while On the way (V2 feature 7)

  if (!order) {
    return (
      <Screen title="Job">
        <Text style={font.body}>{jobs.checking ? 'Loading…' : 'This job is no longer available. Another technician may have taken it.'}</Text>
      </Screen>
    );
  }

  const open = order.status === 'confirmed';
  const step = nextProviderStep(order.status);
  const photo = order.photoUrl ?? order.photoUri;
  const phone = order.customerPhone;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      Alert.alert('Could not update the job', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={`Job #${order.id}`}
      right={<Badge label={STATUS_LABEL[order.status]} tone={open ? 'warn' : 'info'} />}
      footer={
        open ? (
          <PrimaryButton label="Accept Job" icon="checkmark-circle-outline" loading={busy} onPress={() => run(() => jobs.accept(order))} testID="provider-accept" />
        ) : step ? (
          <PrimaryButton label={step.label} icon={step.icon as IconName} loading={busy} onPress={() => run(() => jobs.advance(order, step.next))} testID="provider-next-step" />
        ) : (
          <PrimaryButton label="Back to Jobs" variant="secondary" onPress={() => navigation.goBack()} />
        )
      }
    >
      <MapPreview center={order.address.coords} height={190} interactive={false} />
      {location.sharing ? <Banner tone="success" icon="navigate-outline" text="Sharing your live location with the driver." /> : null}
      {location.error ? <Banner tone="danger" text={location.error} /> : null}
      <Card style={{ gap: 8 }}>
        <Row label="Service" value={order.title} />
        <Row label="Car" value={order.carLabel} />
        <Row label="Location" value={order.address.line} />
        {order.address.landmark && order.address.landmark !== order.address.line ? <Row label="Directions" value={order.address.landmark} /> : null}
        {order.towTo ? <Row label="Tow to" value={`${order.towTo.name} (${order.towTo.distanceKm} km)`} /> : null}
        <Row label="When" value={order.schedule.kind === 'later' ? `${order.schedule.date} · ${order.schedule.time}` : 'Now (ASAP)'} />
        {order.notes ? <Row label="Notes" value={order.notes} /> : null}
        <Row label="Price" value={`${formatQAR(order.quote.total)} · ${order.payment === 'cash' ? 'Cash on service' : 'Card'}`} strong />
      </Card>

      <SectionLabel>Photo of the car</SectionLabel>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" accessibilityLabel="Photo of the customer's car" testID="provider-car-photo" />
      ) : (
        <Text style={font.small}>The driver did not attach a photo.</Text>
      )}

      <SectionLabel>Customer</SectionLabel>
      {open ? (
        <Banner icon="lock-closed-outline" text="Accept the job to see the driver's name and contact details." />
      ) : (
        <Card style={styles.customer}>
          <View style={{ flex: 1 }}>
            <Text style={[font.h3, { fontSize: 15 }]}>{order.customerName ?? 'Driver'}</Text>
            {phone ? <Text style={font.small}>+974 {formatPhone(phone)}</Text> : null}
          </View>
          {phone ? (
            <>
              <Pressable style={[styles.round, { backgroundColor: colors.primary }]} onPress={() => callNumber(`+974${phone}`)} accessibilityLabel="Call the driver">
                <Ionicons name="call" size={18} color="#fff" />
              </Pressable>
              <Pressable style={styles.round} onPress={() => openWhatsApp(`+974${phone}`, `Hi, this is your SANAD technician for order #${order.id}.`)} accessibilityLabel="Message the driver on WhatsApp">
                <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
              </Pressable>
            </>
          ) : null}
        </Card>
      )}
      {jobs.source === 'device' ? <Text style={font.small}>Provider Mode test on this phone: the driver's Track Order screen follows each step you take.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.surface },
  customer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
});
