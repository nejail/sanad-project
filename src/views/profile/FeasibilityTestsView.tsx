import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { MapPreview } from '../../components/MapPreview';
import { Badge, Banner, Card, PrimaryButton, Screen, SectionLabel } from '../../components/ui';
import { FeasibilityTest, TESTS, TestStatus } from '../../feasibility/tests';
import { DOHA } from '../../services/location';
import { colors, font } from '../../theme';

interface Result {
  status: TestStatus;
  detail?: string;
  ms?: number;
}

const env = () =>
  `${Device.manufacturer ?? ''} ${Device.modelName ?? Platform.OS} · ${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''} · ${
    Device.isDevice ? 'physical device' : 'simulator/emulator'
  } · ${Constants.executionEnvironment ?? 'unknown runtime'}`.trim();

/**
 * Runs each key technology SANAD depends on and records pass/fail, timing and detail.
 * Results can be shared as text for the Sprint 3 feasibility report.
 */
export default function FeasibilityTestsView() {
  const [results, setResults] = useState<Record<string, Result>>({ map: { status: 'running' } });
  const [runningAll, setRunningAll] = useState(false);

  const set = (id: string, r: Result) => setResults((prev) => ({ ...prev, [id]: r }));

  const runOne = async (t: FeasibilityTest) => {
    set(t.id, { status: 'running' });
    const start = Date.now();
    try {
      const detail = await t.run();
      set(t.id, { status: 'pass', detail, ms: Date.now() - start });
    } catch (e) {
      set(t.id, { status: 'fail', detail: (e as Error).message, ms: Date.now() - start });
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const t of TESTS.filter((x) => !x.manual)) await runOne(t);
    setRunningAll(false);
  };

  const all: { id: string; name: string; technology: string }[] = [
    { id: 'map', name: 'Map rendering', technology: 'react-native-maps' },
    ...TESTS,
  ];
  const passed = all.filter((t) => results[t.id]?.status === 'pass').length;
  const ran = all.filter((t) => results[t.id] && results[t.id].status !== 'running' && results[t.id].status !== 'idle').length;

  const share = () => {
    const lines = all.map((t) => {
      const r = results[t.id];
      return `${r?.status === 'pass' ? 'PASS' : r?.status === 'fail' ? 'FAIL' : 'NOT RUN'} | ${t.name} (${t.technology})${r?.ms != null ? ` | ${r.ms} ms` : ''}${r?.detail ? ` | ${r.detail}` : ''}`;
    });
    Share.share({ message: `SANAD feasibility tests\n${env()}\n${new Date().toISOString()}\n\n${lines.join('\n')}` });
  };

  return (
    <Screen
      title="Feasibility Tests"
      footer={
        <>
          <PrimaryButton label={runningAll ? 'Running…' : 'Run Automatic Tests'} onPress={runAll} loading={runningAll} testID="run-all" />
          <PrimaryButton label="Share Results" variant="secondary" icon="share-outline" onPress={share} />
        </>
      }
    >
      <Banner text={`Device: ${env()}`} icon="phone-portrait-outline" />
      <Text style={font.small}>{passed} of {all.length} passed · {ran} run. Camera and photo library need you to tap them.</Text>

      <SectionLabel>Map rendering</SectionLabel>
      <MapPreview center={DOHA} height={140} interactive={false} onReady={() => set('map', { status: 'pass', detail: 'Map tiles loaded (onMapReady fired)' })} />
      <StatusLine result={results.map} />

      <SectionLabel>Device technologies</SectionLabel>
      {TESTS.map((t) => (
        <Card key={t.id} style={{ gap: 6 }} onPress={() => runOne(t)} testID={`test-${t.id}`}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { fontSize: 15 }]}>{t.name}</Text>
              <Text style={[font.small, { color: colors.primary }]}>{t.technology}</Text>
            </View>
            {t.manual ? <Badge label="Tap to test" /> : null}
          </View>
          <Text style={font.small}>Used for: {t.usedFor}</Text>
          <StatusLine result={results[t.id]} />
        </Card>
      ))}
    </Screen>
  );
}

function StatusLine({ result }: { result?: Result }) {
  if (!result || result.status === 'idle') return <Text style={font.small}>Not run yet</Text>;
  if (result.status === 'running')
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={font.small}>Running…</Text>
      </View>
    );
  const pass = result.status === 'pass';
  return (
    <View style={[styles.row, { alignItems: 'flex-start' }]}>
      <Ionicons name={pass ? 'checkmark-circle' : 'close-circle'} size={18} color={pass ? colors.success : colors.danger} />
      <Text style={{ color: pass ? colors.subtext : '#fecaca', fontSize: 12, flex: 1 }}>
        {pass ? 'Pass' : 'Fail'}{result.ms != null ? ` · ${result.ms} ms` : ''}{result.detail ? ` · ${result.detail}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
