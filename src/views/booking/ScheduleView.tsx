import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip, OptionRow, PrimaryButton, Screen, SectionLabel } from '../../components/ui';
import { ScreenProps } from '../../navigation/types';
import { useApp } from '../../viewModels/AppContext';
import { colors } from '../../theme';

const TIMES = ['9 AM', '12 PM', '3 PM', '6 PM'];

function nextDays(n: number) {
  const out: { iso: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    const label = x.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    out.push({ iso: x.toISOString().slice(0, 10), label: i === 0 ? `Today ${x.getDate()}` : label });
  }
  return out;
}

/** 08 Schedule: now (ASAP) or a later date and time. */
export default function ScheduleView({ navigation }: ScreenProps<'Schedule'>) {
  const { draft, updateDraft } = useApp();
  const days = useMemo(() => nextDays(4), []);
  const schedule = draft.schedule ?? { kind: 'asap' as const };
  const later = schedule.kind === 'later';

  useEffect(() => {
    if (!draft.schedule) updateDraft({ schedule: { kind: 'asap' } });
  }, []);

  const ready = !later || (schedule.date && schedule.time);

  return (
    <Screen title="Schedule" footer={<PrimaryButton label="Continue" disabled={!ready} onPress={() => navigation.navigate('ReviewOrder')} testID="schedule-continue" />}>
      <SectionLabel>When do you need service?</SectionLabel>
      <OptionRow icon="time-outline" title="Now (ASAP)" subtitle="Technician arrives in about 30 min" selected={!later} onPress={() => updateDraft({ schedule: { kind: 'asap' } })} />
      <OptionRow icon="calendar-outline" title="Later" subtitle="Pick a date and time" selected={later} onPress={() => updateDraft({ schedule: { kind: 'later', date: days[1].iso, time: undefined } })} testID="schedule-later" />
      <View style={{ opacity: later ? 1 : 0.4, gap: 10 }} pointerEvents={later ? 'auto' : 'none'}>
        <SectionLabel>Select Date</SectionLabel>
        <View style={styles.chips}>
          {days.map((d) => (
            <Chip key={d.iso} label={d.label} selected={later && schedule.date === d.iso} onPress={() => updateDraft({ schedule: { ...schedule, kind: 'later', date: d.iso } })} />
          ))}
        </View>
        <SectionLabel>Select Time</SectionLabel>
        <View style={styles.chips}>
          {TIMES.map((t) => (
            <Chip key={t} label={t} selected={later && schedule.time === t} onPress={() => updateDraft({ schedule: { ...schedule, kind: 'later', time: t } })} />
          ))}
        </View>
      </View>
      <View style={styles.eta}>
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.text, fontWeight: '600' }}>
          {later ? (schedule.time ? `Booked for ${days.find((d) => d.iso === schedule.date)?.label ?? ''}, ${schedule.time}` : 'Choose a time slot') : 'Estimated arrival: within 30 minutes'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eta: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
