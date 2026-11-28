import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Badge, Banner, Card, IconName, IconTile, PrimaryButton, Screen, SectionLabel } from '../../components/ui';
import { getService } from '../../models/catalog';
import { formatQAR } from '../../models/pricing';
import { STATUS_LABEL } from '../../models/tracking';
import { Order } from '../../models/types';
import { ScreenProps } from '../../navigation/types';
import { useApp } from '../../viewModels/AppContext';
import { useProviderJobs } from '../../viewModels/useProviderJobs';
import { useProviderRating } from '../../viewModels/useReviews';
import { colors, font } from '../../theme';

/** "5 min ago", "Just now", or the time for older requests. */
export function ageLabel(iso: string, now = Date.now()): string {
  const min = Math.floor((now - Date.parse(iso)) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Provider Mode: new requests a technician can accept, and the jobs they are working on (V2 feature 4). */
export default function ProviderJobsView({ navigation }: ScreenProps<'ProviderJobs'>) {
  const jobs = useProviderJobs();
  // Average of this technician's reviews (V2 feature 14), the profile value until the first one.
  const rating = useProviderRating(jobs.source === 'firestore' ? jobs.profile.id : null, jobs.profile.rating);
  const { providerTestMode, setProviderTestMode } = useApp();
  const [accepting, setAccepting] = useState<string | null>(null);

  const accept = async (order: Order) => {
    setAccepting(order.id);
    try {
      await jobs.accept(order);
      navigation.navigate('ProviderJob', { orderId: order.id });
    } catch (e) {
      Alert.alert('Could not accept', (e as Error).message);
    } finally {
      setAccepting(null);
    }
  };

  return (
    <Screen title="Provider Mode" testID="provider-mode">
      {jobs.checking ? (
        <View style={styles.row}><ActivityIndicator color={colors.primary} /><Text style={font.small}>Checking your technician account…</Text></View>
      ) : jobs.source === 'firestore' ? (
        <>
          <Banner tone="success" icon="shield-checkmark-outline" text={`Signed in as technician ${jobs.profile.name}${jobs.profile.businessName ? ` (${jobs.profile.businessName})` : ''}. New requests appear here as drivers send them.`} />
          <View style={styles.row}>
            <Text style={{ color: colors.text, flex: 1 }}>Available for new jobs</Text>
            <Switch
              value={jobs.profile.isOnline}
              onValueChange={(on) => jobs.setOnline(on)}
              trackColor={{ true: colors.success, false: colors.border }}
              testID="provider-online-switch"
            />
          </View>
          {!jobs.profile.isOnline ? <Text style={[font.small, { color: colors.price }]}>Offline: new requests go to other technicians.</Text> : null}
          <Text style={font.small} testID="provider-rating">
            Your rating: ★ {rating.rating}{rating.count ? ` from ${rating.count} review${rating.count > 1 ? 's' : ''}` : ' (no reviews yet)'}
          </Text>
        </>
      ) : (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Test on this phone</Text>
          <Text style={font.small}>
            {jobs.notRegistered ? 'This number is not registered as a SANAD technician. ' : ''}
            Turn this on, book a service as the driver, then come back here to accept it and move it along. Track Order updates as you go.
          </Text>
          <View style={styles.row}>
            <Text style={{ color: colors.text, flex: 1 }}>Send my new orders to Provider Mode</Text>
            <Switch
              value={providerTestMode}
              onValueChange={setProviderTestMode}
              trackColor={{ true: colors.primary, false: colors.border }}
              testID="provider-test-switch"
            />
          </View>
          {!providerTestMode ? <Text style={[font.small, { color: colors.price }]}>Off: new orders use the automatic demo technician.</Text> : null}
        </Card>
      )}
      {jobs.error ? <Banner tone="danger" text={jobs.error} /> : null}

      <SectionLabel right={<Badge label={`${jobs.open.length}`} />}>New requests</SectionLabel>
      {jobs.open.length === 0 ? <Text style={font.small}>No new requests right now.</Text> : null}
      {jobs.open.map((o) => (
        <JobCard key={o.id} order={o} onPress={() => navigation.navigate('ProviderJob', { orderId: o.id })}>
          <PrimaryButton label="Accept Job" icon="checkmark-circle-outline" onPress={() => accept(o)} loading={accepting === o.id} testID={`accept-${o.id}`} />
        </JobCard>
      ))}

      <SectionLabel>My jobs</SectionLabel>
      {jobs.mine.length === 0 ? <Text style={font.small}>Jobs you accept appear here.</Text> : null}
      {jobs.mine.map((o) => (
        <JobCard key={o.id} order={o} onPress={() => navigation.navigate('ProviderJob', { orderId: o.id })} />
      ))}
    </Screen>
  );
}

/** One job: service, where, which car, price and status. */
export function JobCard({ order, onPress, children }: { order: Order; onPress: () => void; children?: React.ReactNode }) {
  const done = order.status === 'done' || order.status === 'cancelled';
  return (
    <Card onPress={onPress} style={{ gap: 10 }} testID="provider-job">
      <View style={styles.row}>
        <IconTile name={getService(order.serviceId).icon as IconName} />
        <View style={{ flex: 1 }}>
          <Text style={[font.h3, { fontSize: 15 }]} numberOfLines={1}>{order.title}</Text>
          <Text style={font.small} numberOfLines={1}>{order.address.line}</Text>
          <Text style={font.small} numberOfLines={1}>{order.carLabel} · {ageLabel(order.createdAt)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge label={STATUS_LABEL[order.status]} tone={done ? 'success' : order.status === 'confirmed' ? 'warn' : 'info'} />
          <Text style={{ color: colors.text, fontWeight: '700' }}>{formatQAR(order.quote.total)}</Text>
        </View>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
