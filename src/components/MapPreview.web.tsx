import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MapPreviewProps } from './MapPreview';
import { colors } from '../theme';

/**
 * react-native-maps has no web implementation, so the browser preview shows a
 * stylised placeholder in the same spot. Run on a phone or simulator for the real map.
 */
export function MapPreview({ center, provider, height = 220, onReady }: MapPreviewProps) {
  useEffect(() => {
    onReady?.();
  }, []);
  return (
    <View style={[styles.wrap, { height }]}>
      <View style={[styles.road, { top: '45%', left: 0, right: 0, height: 14 }]} />
      <View style={[styles.road, { left: '45%', top: 0, bottom: 0, width: 14 }]} />
      <View style={[styles.block, { top: 16, left: 16 }]} />
      <View style={[styles.block, { top: 16, right: 16, backgroundColor: '#1e3a5f' }]} />
      <View style={[styles.block, { bottom: 16, left: 16, backgroundColor: '#14532d' }]} />
      <View style={[styles.block, { bottom: 16, right: 16 }]} />
      <View style={styles.pin}>
        <Ionicons name="location" size={34} color={colors.primary} />
      </View>
      {provider ? (
        <View style={[styles.pin, { top: '18%', left: '68%' }]}>
          <Ionicons name="car" size={22} color={colors.price} />
        </View>
      ) : null}
      <Text style={styles.caption}>
        {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)} · map preview (web)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#172238' },
  road: { position: 'absolute', backgroundColor: '#22314d' },
  block: { position: 'absolute', width: '30%', height: '28%', borderRadius: 8, backgroundColor: '#1f2a40' },
  pin: { position: 'absolute', top: '36%', left: '42%' },
  caption: { position: 'absolute', bottom: 6, right: 10, color: colors.muted, fontSize: 10 },
});
