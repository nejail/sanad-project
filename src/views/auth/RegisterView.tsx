import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Banner, Field, LinkText, PrimaryButton } from '../../components/ui';
import { isValidName, isValidQatarMobile, normalizePhone } from '../../models/validation';
import { ScreenProps } from '../../navigation/types';
import { useApp } from '../../viewModels/AppContext';
import { AuthLayout, Terms } from './AuthLayout';

/**
 * 02a Register. Normally: phone + name -> OTP -> Add First Car.
 * If the number was already verified on the sign in path but has no account,
 * the user only needs to add a name (no second code).
 */
export default function RegisterView({ navigation, route }: ScreenProps<'Register'>) {
  const { register, accountExists } = useApp();
  const verified = route.params?.verified === true;
  const [phone, setPhone] = useState(route.params?.phone ?? '');
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const phoneOk = isValidQatarMobile(phone);
  const nameOk = isValidName(name);

  const submit = async () => {
    setTouched(true);
    if (!phoneOk || !nameOk) return;
    const p = normalizePhone(phone);
    setBusy(true);
    try {
      if (await accountExists(p)) {
        Alert.alert('Account exists', 'This number already has a SANAD account. Sign in instead.');
        navigation.navigate('Login');
        return;
      }
      if (verified) await register(p, name);
      else navigation.navigate('VerifyOtp', { phone: p, mode: 'register', name: name.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={verified ? 'Complete Your Account' : 'Create Your Account'}
      subtitle={verified ? 'No account was found for this number' : 'Register to book your first service'}
      footer={
        <>
          <PrimaryButton label={verified ? 'Create Account' : 'Send Code'} onPress={submit} loading={busy} testID="register-submit" />
          <LinkText prefix="Already have an account? " label="Sign in" onPress={() => navigation.navigate('Login')} />
          <Terms />
        </>
      }
    >
      {verified ? <Banner icon="shield-checkmark-outline" text="Your number is verified. Add your name to finish." /> : null}
      <View style={{ gap: 18 }}>
        <Field
          label="Phone Number"
          prefix="+974"
          value={phone}
          editable={!verified}
          onChangeText={(t) => setPhone(normalizePhone(t))}
          placeholder="5012 3456"
          keyboardType="phone-pad"
          maxLength={8}
          error={touched && !phoneOk ? 'Enter an 8-digit Qatar mobile number' : undefined}
        />
        <Field
          label="Your Name"
          value={name}
          onChangeText={setName}
          placeholder="Hassan"
          autoCapitalize="words"
          textContentType="name"
          error={touched && !nameOk ? 'Enter your name' : undefined}
          testID="name-input"
        />
      </View>
    </AuthLayout>
  );
}
