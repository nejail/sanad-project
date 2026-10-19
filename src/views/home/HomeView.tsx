import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Logo } from '../../components/Logo';
import { IconName, IconTile } from '../../components/ui';
import { HOME_SERVICE_ORDER, getService } from '../../models/catalog';
import { ServiceId } from '../../models/types';
import { RootStackParamList } from '../../navigation/types';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/** 03 Home: greeting, promo, the user's registered cars, and the six services. */
export default function HomeView() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { startBooking } = useApp();
  const { user, cars, orders } = useAccount();
  const active = orders.find((o) => o.status === 'confirmed' || o.status === 'on_the_way' || o.status === 'arrived');

  const open = (id: ServiceId) => {
    startBooking(id);
    nav.navigate('Service', { serviceId: id });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.topbar}>
        <Logo size={30} />
        <Text style={[font.h3, { flex: 1, fontSize: 18 }]}>SANAD</Text>
        <Pressable style={styles.bell} accessibilityLabel="Notifications" onPress={() => nav.navigate('Tabs', { screen: 'Orders' })}>
          <Ionicons name="notifications-outline" size={18} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: 'row', gap: 8 }} testID="greeting">
          <Text style={[font.h2, { fontSize: 22 }]}>مرحبا</Text>
          <Text style={[font.h2, { fontSize: 22 }]}>{user.name}</Text>
        </View>

        <LinearGradient colors={[colors.promoStart, colors.promoEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.promo}>
          <View style={styles.promoIcon}>
            <Ionicons name="gift-outline" size={20} color={colors.promoEnd} />
          </View>
          <View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Launch Special</Text>
            <Text style={{ color: '#ede9fe', fontSize: 12 }}>Your first car wash is FREE</Text>
          </View>
        </LinearGradient>

        {active ? (
          <Pressable style={styles.active} onPress={() => nav.navigate('TrackOrder', { orderId: active.id })}>
            <Ionicons name="navigate-circle-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{active.title}</Text>
              <Text style={font.small}>#{active.id} · tap to track</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={font.h3}>My Cars</Text>
          <Text style={styles.link} onPress={() => nav.navigate('Tabs', { screen: 'MyCars' })}>See all</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {cars.map((c) => (
            <View key={c.id} style={[styles.car, c.isDefault && { borderColor: colors.primary }]} testID="home-car">
              <IconTile name="car-outline" size={36} />
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{c.model}</Text>
              <Text style={{ color: colors.price, fontWeight: '700', fontSize: 12 }}>{c.plate}</Text>
            </View>
          ))}
          <Pressable style={[styles.car, styles.addCar]} onPress={() => nav.navigate('AddCar')}>
            <IconTile name="add" size={36} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Add Car</Text>
          </Pressable>
        </ScrollView>

        <Text style={[font.h3, { marginTop: 8 }]}>Services</Text>
        <View style={styles.grid}>
          {HOME_SERVICE_ORDER.map((id) => {
            const s = getService(id);
            const danger = s.accent === 'danger';
            return (
              <Pressable
                key={id}
                testID={`service-${id}`}
                onPress={() => open(id)}
                style={({ pressed }) => [styles.service, danger && styles.serviceDanger, { opacity: pressed ? 0.8 : 1 }]}
              >
                <IconTile name={s.icon as IconName} size={34} color={danger ? colors.danger : colors.primary} bg={danger ? colors.dangerSoft : colors.primarySoft} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: danger ? '#fecaca' : colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={2}>{s.shortTitle}</Text>
                  <Text style={font.small}>{s.fromLabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface },
  bell: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 14, paddingBottom: 30 },
  promo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12 },
  promoIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  active: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  car: {
    width: 112, height: 120, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8,
  },
  addCar: { width: 80, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: 'transparent' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  service: {
    width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  serviceDanger: { borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(127,29,29,0.35)' },
});
