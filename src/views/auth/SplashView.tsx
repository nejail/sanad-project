import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '../../components/Logo';
import { useApp } from '../../viewModels/AppContext';

/** Shown for ~2 seconds while the stored session is checked, then routes automatically. */
export const SPLASH_MS = 2000;

export default function SplashView() {
  const { restoreSession } = useApp();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const started = Date.now();
    let cancelled = false;
    (async () => {
      // Check the session in parallel with the minimum splash time.
      await new Promise((r) => setTimeout(r, Math.max(0, SPLASH_MS - (Date.now() - started))));
      if (!cancelled) await restoreSession();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LinearGradient colors={['#0284c7', '#0ea5e9', '#38bdf8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
      <Animated.View style={[styles.center, { opacity: fade }]} testID="splash">
        <View style={styles.tile}>
          <Logo size={110} />
        </View>
        <Text style={styles.arabic}>سَنَد</Text>
        <Text style={styles.title}>SANAD</Text>
        <Text style={styles.tagline}>Your Car, Our Care</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  tile: { width: 140, height: 140, borderRadius: 32, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  arabic: { color: '#fff', fontSize: 30, fontWeight: '700' },
  title: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  tagline: { color: '#e0f2fe', fontSize: 15, marginTop: 6 },
});
