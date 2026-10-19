import React, { useState } from 'react';
import { Field, LinkText, PrimaryButton } from '../../components/ui';
import { isValidQatarMobile, normalizePhone } from '../../models/validation';
import { ScreenProps } from '../../navigation/types';
import { AuthLayout, Terms } from './AuthLayout';

/** 02 Login (sign in): phone number only, a code is sent before anything else happens. */
export default function LoginView({ navigation }: ScreenProps<'Login'>) {
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const valid = isValidQatarMobile(phone);

  const sendCode = () => {
    setTouched(true);
    if (!valid) return;
    navigation.navigate('VerifyOtp', { phone: normalizePhone(phone), mode: 'signin' });
  };

  return (
    <AuthLayout
      title="Welcome to SANAD"
      subtitle="Your Car, Our Care"
      footer={
        <>
          <PrimaryButton label="Send Code" onPress={sendCode} disabled={touched && !valid} testID="send-code" />
          <LinkText prefix="New to SANAD? " label="Create an account" onPress={() => navigation.navigate('Register')} />
          <Terms />
        </>
      }
    >
      <Field
        label="Phone Number"
        prefix="+974"
        value={phone}
        onChangeText={(t) => setPhone(normalizePhone(t))}
        placeholder="5012 3456"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={8}
        onSubmitEditing={sendCode}
        error={touched && !valid ? 'Enter an 8-digit Qatar mobile number' : undefined}
        testID="phone-input"
      />
    </AuthLayout>
  );
}
