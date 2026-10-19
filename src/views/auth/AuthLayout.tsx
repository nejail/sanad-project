import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../../components/Logo';
import { colors, font } from '../../theme';

/** Shared layout for the sign in, register and OTP screens (logo, title, body, footer). */
export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Logo size={80} />
          </View>
          <Text style={[font.title, { textAlign: 'center' }]}>{title}</Text>
          <Text style={[font.body, { textAlign: 'center', marginBottom: 8 }]}>{subtitle}</Text>
          {children}
        </ScrollView>
        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Terms() {
  return <Text style={[font.small, { textAlign: 'center' }]}>By continuing you agree to our Terms and Privacy Policy</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 70, gap: 18 },
  logo: { alignItems: 'center' },
  footer: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
});
