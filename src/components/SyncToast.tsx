import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../viewModels/AppContext';
import { colors } from '../theme';
import { Banner } from './ui';

/** How long the message stays on screen. */
const SHOW_MS = 6000;

/**
 * Short message at the bottom of the screen when saving the account to Firestore fails.
 * Tap to dismiss; it also hides itself after a few seconds.
 */
export function SyncToast() {
  const { syncError, clearSyncError } = useApp();
  const insets = useSafeAreaInsets();

  // Hides the message automatically after SHOW_MS.
  useEffect(() => {
    if (!syncError) return;
    const t = setTimeout(clearSyncError, SHOW_MS);
    return () => clearTimeout(t);
  }, [syncError, clearSyncError]);

  if (!syncError) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <Pressable onPress={clearSyncError} accessibilityRole="alert" accessibilityLabel={syncError} style={styles.card}>
        <Banner tone="danger" icon="cloud-offline-outline" text={syncError} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  card: { borderRadius: 12, backgroundColor: colors.surface },
});
