import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '../theme';
import { formatQAR } from '../models/pricing';
import { Quote } from '../models/types';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Full-height screen with dark background, optional header and sticky footer. */
export function Screen({
  title,
  back = true,
  right,
  footer,
  children,
  scroll = true,
  testID,
}: {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const nav = useNavigation();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID={testID}>
      {title !== undefined && (
        <View style={styles.header}>
          {back && nav.canGoBack() ? (
            <Pressable accessibilityLabel="Back" onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
          ) : null}
          <Text style={[font.h3, { flex: 1, fontSize: 18 }]} numberOfLines={1}>
            {title}
          </Text>
          {right}
        </View>
      )}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  testID?: string;
}) {
  const content = (
    <View style={styles.btnInner}>
      {loading ? <ActivityIndicator color="#fff" /> : icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
      <Text style={styles.btnText}>{label}</Text>
    </View>
  );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.btn, variant === 'danger' ? { backgroundColor: colors.danger } : styles.btnSecondary]}>{content}</View>
      )}
    </Pressable>
  );
}

export function LinkText({ prefix, label, onPress }: { prefix?: string; label: string; onPress: () => void }) {
  return (
    <Text style={[font.body, { textAlign: 'center', fontSize: 14 }]}>
      {prefix}
      <Text onPress={onPress} style={{ color: colors.primary, fontWeight: '600' }} accessibilityRole="link">
        {label}
      </Text>
    </Text>
  );
}

export function Field({
  label,
  prefix,
  error,
  style,
  ...input
}: TextInputProps & { label?: string; prefix?: string; error?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? <Text style={font.label}>{label}</Text> : null}
      <View style={[styles.input, error ? { borderColor: colors.danger } : null]}>
        {prefix ? (
          <>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>{prefix}</Text>
            <View style={styles.inputDivider} />
          </>
        ) : null}
        <TextInput placeholderTextColor={colors.muted} style={styles.inputText} {...input} />
      </View>
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
      <Text style={font.label}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, selected, danger, testID }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  selected?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const border = selected ? (danger ? colors.danger : colors.primary) : colors.border;
  const body = (
    <View style={[styles.card, { borderColor: border, backgroundColor: selected ? (danger ? colors.dangerSoft : colors.primarySoft) : colors.surface }, style]}>
      {children}
    </View>
  );
  return onPress ? (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function IconTile({ name, color = colors.primary, bg = colors.primarySoft, size = 40 }: { name: IconName; color?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.5} color={color} />
    </View>
  );
}

export function Radio({ selected, danger }: { selected: boolean; danger?: boolean }) {
  const c = danger ? colors.danger : colors.primary;
  return (
    <View style={[styles.radio, { borderColor: selected ? c : colors.muted }]}>
      {selected ? <View style={[styles.radioDot, { backgroundColor: c }]} /> : null}
    </View>
  );
}

/** Option row used on the service, schedule and payment screens. */
export function OptionRow({
  icon, title, subtitle, right, selected, onPress, danger, disabled, testID,
}: {
  icon: IconName; title: string; subtitle?: string; right?: string; selected: boolean; onPress: () => void;
  danger?: boolean; disabled?: boolean; testID?: string;
}) {
  return (
    <Card selected={selected} danger={danger} onPress={disabled ? undefined : onPress} style={[styles.row, disabled && { opacity: 0.5 }]} testID={testID}>
      <IconTile name={icon} color={danger ? colors.danger : colors.primary} bg={danger ? colors.dangerSoft : colors.primarySoft} />
      <View style={{ flex: 1 }}>
        <Text style={[font.h3, { fontSize: 15 }]}>{title}</Text>
        {subtitle ? <Text style={font.small}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={{ color: right === 'Free' ? colors.success : colors.price, fontWeight: '700' }}>{right}</Text> : null}
      <Radio selected={selected} danger={danger} />
    </Card>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
    >
      <Text style={{ color: selected ? colors.primary : colors.subtext, fontWeight: selected ? '700' : '500', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function PriceSummary({ quote }: { quote: Quote }) {
  return (
    <Card style={{ gap: 8 }}>
      {quote.lines.map((l) =>
        l.amount < 0 ? (
          <View key={l.label} style={styles.summaryRow}>
            <Text style={{ color: colors.success, fontSize: 13, flexShrink: 1 }}>{l.label}</Text>
            <Text style={{ color: colors.success, fontWeight: '700', fontSize: 13, marginLeft: 12 }}>{formatQAR(l.amount)}</Text>
          </View>
        ) : (
          <Row key={l.label} label={l.label} value={formatQAR(l.amount)} />
        ),
      )}
      <Row label="VAT (5%)" value={formatQAR(quote.vat)} />
      <View style={styles.divider} />
      <View style={styles.summaryRow}>
        <Text style={[font.h3]}>{quote.isEstimate ? 'Estimated from' : 'Total'}</Text>
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>{formatQAR(quote.total)}</Text>
      </View>
    </Card>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[font.small, { fontSize: 13, flexShrink: 0 }]}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: strong ? '700' : '600', fontSize: 13, marginLeft: 12, flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function Badge({ label, tone = 'info' }: { label: string; tone?: 'info' | 'success' | 'warn' | 'danger' }) {
  const map = {
    info: [colors.primarySoft, colors.primary],
    success: [colors.successSoft, colors.success],
    warn: ['rgba(245,165,36,0.15)', colors.price],
    danger: [colors.dangerSoft, colors.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Banner({ text, tone = 'info', icon = 'information-circle-outline' }: { text: string; tone?: 'info' | 'danger'; icon?: IconName }) {
  const c = tone === 'danger' ? colors.danger : colors.primary;
  return (
    <View style={[styles.banner, { borderColor: c, backgroundColor: tone === 'danger' ? colors.dangerSoft : colors.primarySoft }]}>
      <Ionicons name={icon} size={18} color={c} />
      <Text style={{ color: colors.text, flex: 1, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.xl, paddingVertical: 14,
    backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  backBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: 32 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md, gap: 10 },
  btn: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  input: {
    flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, gap: 10,
  },
  inputDivider: { width: 1, height: 24, backgroundColor: colors.border },
  inputText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '500', height: '100%' },
  card: { borderWidth: 1, borderRadius: radius.md, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: 12 },
});
