import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Card, IconTile, Screen } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

/** 12 My Cars (tab) */
export default function MyCarsView() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { cars } = useAccount();
  const { removeCar } = useApp();

  const confirmRemove = (id: string, label: string) =>
    Alert.alert('Remove car', `Remove ${label} from your account?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeCar(id) },
    ]);

  return (
    <Screen title="My Cars" back={false}>
      {cars.map((c) => (
        <Card key={c.id} style={{ gap: 10 }}>
          <View style={styles.row}>
            <IconTile name="car-outline" />
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { fontSize: 15 }]}>{c.make} {c.model}</Text>
              <Text style={font.small}>{c.year} · {c.fuel}</Text>
              <Text style={font.small}>Last service: {c.lastService ?? 'No services yet'}</Text>
            </View>
            <Pressable style={styles.edit} onPress={() => confirmRemove(c.id, `${c.make} ${c.model}`)} accessibilityLabel={`Remove ${c.model}`}>
              <Ionicons name="create-outline" size={16} color={colors.text} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Badge label={c.plate} tone="warn" />
            {c.isDefault ? <Badge label="Default" tone="success" /> : null}
          </View>
        </Card>
      ))}
      <Pressable style={styles.add} onPress={() => nav.navigate('AddCar')} testID="mycars-add">
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Add New Car</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  edit: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary },
});
