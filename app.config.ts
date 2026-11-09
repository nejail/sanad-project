import fs from 'fs';
import path from 'path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { ConfigPlugin, withEntitlementsPlist } from 'expo/config-plugins';

/**
 * Removes the Push Notifications entitlement that expo-notifications adds.
 * SANAD only schedules local notifications, and free Apple ID (Personal Team) builds cannot be
 * signed with push enabled. Firebase phone sign-in then verifies with reCAPTCHA instead of a
 * silent push. Set SANAD_PUSH=1 when building with a paid Apple Developer account to keep it.
 */
const withoutPushEntitlement: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    if (process.env.SANAD_PUSH !== '1') delete mod.modResults['aps-environment'];
    return mod;
  });

/**
 * Adds Firebase to the native build only when the Firebase config files are present.
 * Without them (e.g. a fresh clone used in Expo Go) the app still starts and uses the
 * prototype sign-in, so teammates can work before they have the files.
 */
export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const iosFile = path.join(projectRoot, 'GoogleService-Info.plist');
  const androidFile = path.join(projectRoot, 'google-services.json');
  const hasIos = fs.existsSync(iosFile);
  const hasAndroid = fs.existsSync(androidFile);
  const plugins = [...(config.plugins ?? [])];

  if (hasIos || hasAndroid) {
    plugins.push(
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      // React Native Firebase uses Swift Package Manager on iOS, which needs dynamic frameworks.
      ['expo-build-properties', { ios: { useFrameworks: 'dynamic' } }],
    );
  }

  return withoutPushEntitlement({
    ...(config as ExpoConfig),
    ios: { ...config.ios, ...(hasIos ? { googleServicesFile: './GoogleService-Info.plist' } : {}) },
    android: { ...config.android, ...(hasAndroid ? { googleServicesFile: './google-services.json' } : {}) },
    plugins,
  });
};
