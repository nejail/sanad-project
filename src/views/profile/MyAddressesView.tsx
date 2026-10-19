import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, IconTile, Screen } from '../../components/ui';
import { ScreenProps } from '../../navigation/types';
import { useAccount } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/** 15 My Addresses */
export default function MyAddressesView({ navigation }: ScreenProps<'MyAddresses'>) {
  const { addresses } = useAccount();
  return (
    <Screen title="My Addresses">
      {addresses.length === 0 ? <Text style={font.body}>No saved addresses yet.</Text> : null}
      {addresses.map((a) => (
        <Card key={a.id} style={styles.row}>
          <IconTile name={a.label === 'Home' ? 'home-outline' : a.label === 'Office' ? 'business-outline' : 'location-outline'} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={[font.h3, { fontSize: 15 }]}>{a.label}</Text>
              {a.isDefault ? <Badge label="Default" tone="success" /> : null}
            </View>
            <Text style={font.small}>{a.line}</Text>
          </View>
        </Card>
      ))}
      <Pressable style={styles.add} onPress={() => navigation.navigate('AddAddress')} testID="add-address">
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Add New Address</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  add: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary },
});
