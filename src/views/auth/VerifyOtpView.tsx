import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Banner, LinkText, PrimaryButton } from '../../components/ui';
import { OTP_LENGTH } from '../../models/otp';
import { formatPhone } from '../../models/validation';
import { ScreenProps } from '../../navigation/types';
import { getPhoneAuth } from '../../services/auth';
import { useApp } from '../../viewModels/AppContext';
import { colors } from '../../theme';
import { AuthLayout } from './AuthLayout';

/**
 * 02b / 02c Verify OTP. Used for both sign in and registration.
 * In the development build the code arrives by SMS through Firebase Authentication;
 * in Expo Go it falls back to the prototype code shown as a notification.
 */
export default function VerifyOtpView({ navigation, route }: ScreenProps<'VerifyOtp'>) {
  const { phone, mode, name } = route.params;
  const { signIn, register, accountExists } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const auth = getPhoneAuth();

  /** Requests a code (SMS in Firebase mode, notification in local mode) and starts the resend timer. */
  const send = useCallback(async () => {
    setCode('');
    setError('');
    setSending(true);
    try {
      const result = await auth.sendCode(phone);
      setCooldown(result.cooldownSeconds);
      setFallbackCode(result.localCode ?? null);
      setShowCode(false);
    } catch (e) {
      setError((e as Error).message);
      setCooldown(0);
    } finally {
      setSending(false);
    }
  }, [phone, auth]);

  useEffect(() => {
    send();
  }, [send]);

  // Counts the resend timer down once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /** Confirms the code, then routes: new user -> Add First Car, returning user -> Home, unknown number -> Register. */
  const verify = async (value = code) => {
    if (value.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    try {
      const user = await auth.confirmCode(phone, value);
      if (mode === 'register' && name) {
        await register(phone, name, user.uid); // new user, no cars yet -> Add First Car
      } else if (await accountExists(phone)) {
        await signIn(phone, user.uid); // returning user -> Home with registered cars loaded
      } else {
        navigation.replace('Register', { phone, verified: true, uid: user.uid });
      }
    } catch (e) {
      setError((e as Error).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const onChange = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (error) setError('');
    if (digits.length === OTP_LENGTH) verify(digits);
  };

  return (
    <AuthLayout
      title="Verify Your Number"
      subtitle={`Enter the ${OTP_LENGTH}-digit code sent to\n+974 ${formatPhone(phone)}`}
      footer={
        <>
          <PrimaryButton label="Verify" onPress={() => verify()} disabled={code.length !== OTP_LENGTH} loading={busy} testID="verify" />
          <LinkText label="Change phone number" onPress={() => navigation.goBack()} />
        </>
      }
    >
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxes} accessibilityLabel="Enter verification code">
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          const active = i === code.length;
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, error ? styles.boxError : null]}>
              <Text style={styles.digit}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        autoFocus
        style={styles.hidden}
        testID="otp-input"
      />
      {sending ? <Text style={styles.resend}>{auth.mode === 'firebase' ? 'Sending SMS…' : 'Sending code…'}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.resend}>
        Didn't receive a code?{' '}
        {cooldown > 0 ? (
          <Text style={{ color: colors.primary }}>Resend in 0:{String(cooldown).padStart(2, '0')}</Text>
        ) : (
          <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={sending ? undefined : send}>
            Resend code
          </Text>
        )}
      </Text>
      {fallbackCode ? (
        <Banner
          text={
            showCode
              ? `Prototype only: your code is ${fallbackCode}. In the real app it arrives by SMS.`
              : 'Notifications are off, so the SMS stand-in could not be shown. Tap here to see the code.'
          }
        />
      ) : null}
      {fallbackCode && !showCode ? <LinkText label="Show prototype code" onPress={() => setShowCode(true)} /> : null}
      <Text style={styles.mode} testID="auth-mode">
        {auth.mode === 'firebase' ? 'Secured by Firebase Authentication' : 'Prototype mode: code shown on this phone (Expo Go)'}
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  box: {
    width: 46, height: 56, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary, borderWidth: 2 },
  boxError: { borderColor: colors.danger },
  digit: { color: colors.text, fontSize: 22, fontWeight: '700' },
  mode: { color: colors.muted, textAlign: 'center', fontSize: 11, marginTop: 8 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: { color: colors.danger, textAlign: 'center', fontSize: 13 },
  resend: { color: colors.muted, textAlign: 'center', fontSize: 13 },
});
