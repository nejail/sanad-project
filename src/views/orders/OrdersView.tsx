import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Card, IconName, IconTile, Screen } from '../../components/ui';
import { getService } from '../../models/catalog';
import { formatQAR } from '../../models/pricing';
import { STATUS_LABEL, isActiveStatus } from '../../models/tracking';
import { Order } from '../../models/types';
import { RootStackParamList } from '../../navigation/types';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

const isActive = (o: Order) => isActiveStatus(o.status);

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** 13 My Orders (tab). Finished orders have "Book again" (V2 feature 15). */
export default function OrdersView() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orders } = useAccount();
  const { bookAgain } = useApp();
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const active = orders.filter(isActive);
  const completed = orders.filter((o) => !isActive(o));
  const list = tab === 'active' ? active : completed;

  return (
    <Screen title="My Orders" back={false}>
      <View style={styles.segment}>
        {(['active', 'completed'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.seg, tab === t && styles.segOn]}>
            <Text style={{ color: tab === t ? '#fff' : colors.subtext, fontWeight: '600' }}>{t === 'active' ? 'Active' : 'Completed'}</Text>
          </Pressable>
        ))}
      </View>
      {list.length === 0 ? <Text style={[font.body, { textAlign: 'center', marginTop: 30 }]}>No {tab} orders yet.</Text> : null}
      {list.map((o) => (
        <Card key={o.id} style={styles.row} onPress={() => nav.navigate('TrackOrder', { orderId: o.id })}>
          <IconTile name={getService(o.serviceId).icon as IconName} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[font.h3, { fontSize: 15 }]}>{o.title}</Text>
            <Text style={font.small}>#{o.id} · {dateLabel(o.createdAt)}</Text>
            {!isActive(o) ? (
              <Pressable
                onPress={() => {
                  bookAgain(o);
                  nav.navigate('Service', { serviceId: o.serviceId });
                }}
                style={styles.again}
                accessibilityLabel={`Book ${o.title} again`}
                testID={`book-again-${o.id}`}
              >
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Book again</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge label={STATUS_LABEL[o.status]} tone={o.status === 'accepted' ? 'success' : isActive(o) ? 'info' : 'success'} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>{formatQAR(o.quote.total)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: colors.border },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segOn: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  again: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.primary },
});
