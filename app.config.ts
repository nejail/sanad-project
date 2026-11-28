import fs from 'fs';
import path from 'path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { ConfigPlugin, withEntitlementsPlist, withPlugins } from 'expo/config-plugins';

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
 * The iOS part of React Native Firebase's config plugin (@react-native-firebase/app 27.1.0), for builds
 * without google-services.json: the plugin's Android steps would stop the Android build.
 */
const withFirebaseIosOnly = (projectRoot: string): ConfigPlugin => (config) => {
  // The package does not export this file, so it is loaded by its path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ios = require(path.join(projectRoot, 'node_modules/@react-native-firebase/app/plugin/build/ios'));
  return withPlugins(config, [ios.withFirebaseAppDelegate, ios.withIosGoogleServicesFile, [ios.withIosDisableSPM, undefined]]);
};

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
      // Without google-services.json only the plugin's iOS steps run (below), so Android builds in prototype mode.
      ...(hasAndroid ? ['@react-native-firebase/app'] : []),
      '@react-native-firebase/auth',
    );
  }
  plugins.push([
    'expo-build-properties',
    {
      // React Native Firebase uses Swift Package Manager on iOS, which needs dynamic frameworks.
      ios: hasIos || hasAndroid ? { useFrameworks: 'dynamic' } : {},
      android: {
        // Firebase's Android libraries (BoM 35) are built with Kotlin 2.4; React Native 0.88 defaults to 2.2.
        kotlinVersion: '2.4.0',
        // Release builds shrink code with R8, which removed WorkManager's database class and crashed the app at start.
        extraProguardRules: '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
      },
    },
  ]);

  const full: ExpoConfig = {
    ...(config as ExpoConfig),
    ios: { ...config.ios, ...(hasIos ? { googleServicesFile: './GoogleService-Info.plist' } : {}) },
    android: { ...config.android, ...(hasAndroid ? { googleServicesFile: './google-services.json' } : {}) },
    plugins,
  };
  return withoutPushEntitlement(hasIos && !hasAndroid ? withFirebaseIosOnly(projectRoot)(full) : full);
};
