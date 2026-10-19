import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { IconName, IconTile, Screen } from '../../components/ui';
import { formatPhone } from '../../models/validation';
import { RootStackParamList } from '../../navigation/types';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/** 14 Profile (tab) */
export default function ProfileView() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, orders } = useAccount();
  const { signOut } = useApp();
  const spent = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.quote.total, 0);

  const soon = (what: string) => Alert.alert(what, 'Not part of this prototype yet.');
  const items: { icon: IconName; title: string; sub: string; onPress: () => void; testID?: string }[] = [
    { icon: 'create-outline', title: 'Edit Profile', sub: 'Update your information', onPress: () => soon('Edit Profile') },
    { icon: 'location-outline', title: 'My Addresses', sub: 'Manage saved locations', onPress: () => nav.navigate('MyAddresses') },
    { icon: 'card-outline', title: 'Payment Methods', sub: 'Coming soon', onPress: () => soon('Payment Methods') },
    { icon: 'flask-outline', title: 'Technology Feasibility Tests', sub: 'Run the device checks for this prototype', onPress: () => nav.navigate('FeasibilityTests'), testID: 'open-feasibility' },
    { icon: 'help-circle-outline', title: 'Help & Support', sub: 'Get assistance', onPress: () => soon('Help & Support') },
    { icon: 'information-circle-outline', title: 'About SANAD', sub: 'Prototype v0.3 (Sprint 3)', onPress: () => soon('About SANAD') },
  ];

  return (
    <Screen title="Profile" back={false}>
      <View style={styles.head}>
        <View style={styles.avatar}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 20 }}>{user.name[0] ?? '?'}</Text></View>
        <View>
          <Text style={[font.h2]}>{user.name}</Text>
          <Text style={font.small}>+974 {formatPhone(user.phone)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={styles.stat}>
          <Text style={{ color: colors.primary, fontSize: 22, fontWeight: '800' }}>{orders.length}</Text>
          <Text style={font.small}>Total Orders</Text>
        </View>
        <View style={styles.stat}>
          <Text style={{ color: colors.price, fontSize: 22, fontWeight: '800' }}>{spent.toFixed(2)}</Text>
          <Text style={font.small}>QAR Spent</Text>
        </View>
      </View>
      <View style={styles.menu}>
        {items.map((it, i) => (
          <Pressable key={it.title} onPress={it.onPress} testID={it.testID} style={[styles.item, i < items.length - 1 && styles.itemBorder]}>
            <IconTile name={it.icon} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{it.title}</Text>
              <Text style={font.small}>{it.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <Pressable
        style={styles.logout}
        onPress={() => Alert.alert('Log out', 'You will need a new code to sign in again.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out', style: 'destructive', onPress: signOut },
        ])}
        testID="logout"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Logout</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 2 },
  menu: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
});
