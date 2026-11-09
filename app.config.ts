import fs from 'fs';
import path from 'path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

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

  return {
    ...(config as ExpoConfig),
    ios: { ...config.ios, ...(hasIos ? { googleServicesFile: './GoogleService-Info.plist' } : {}) },
    android: { ...config.android, ...(hasAndroid ? { googleServicesFile: './google-services.json' } : {}) },
    plugins,
  };
};
