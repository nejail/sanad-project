import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LocalOtpService, OTP_TTL_MS } from '../models/otp';
import { canDial } from '../services/contact';
import { getCurrentPlace, reverseGeocode, DOHA } from '../services/location';
import { pickCarPhoto } from '../services/media';
import { notify } from '../services/notifications';
import { secureStoreRoundTrip } from '../services/session';
import { storageRoundTrip } from '../services/storage';

export type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

export interface FeasibilityTest {
  id: string;
  technology: string; // library / platform API
  name: string;
  usedFor: string; // where SANAD needs it
  manual?: boolean; // needs a user action (camera, gallery)
  run: () => Promise<string>; // resolves with a detail string, rejects on failure
}

export const TESTS: FeasibilityTest[] = [
  {
    id: 'gps',
    technology: 'expo-location',
    name: 'GPS position',
    usedFor: 'Find the driver on the Location screen and send it to the provider',
    run: async () => {
      const p = await getCurrentPlace();
      return `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} ±${Math.round(p.accuracy ?? 0)} m in ${p.ms} ms`;
    },
  },
  {
    id: 'geocode',
    technology: 'expo-location (reverse geocoding)',
    name: 'Address lookup',
    usedFor: 'Turn coordinates into a readable address for the order',
    run: async () => {
      if (Platform.OS === 'web') throw new Error('Reverse geocoding is not supported in the browser');
      return `Doha centre resolves to "${await reverseGeocode(DOHA)}"`;
    },
  },
  {
    id: 'notify',
    technology: 'expo-notifications (local)',
    name: 'Notifications',
    usedFor: 'OTP stand-in, order placed, technician on the way and arrived',
    run: async () => {
      const ok = await notify('SANAD test', 'If you can read this, local notifications work.', 3);
      if (!ok) throw new Error('Permission denied or notifications unavailable');
      return 'Scheduled a notification for 3 seconds from now; check that it appears';
    },
  },
  {
    id: 'secure',
    technology: 'expo-secure-store',
    name: 'Secure session storage',
    usedFor: 'Keep the signed-in session in the keychain so Splash can skip sign in',
    run: secureStoreRoundTrip,
  },
  {
    id: 'storage',
    technology: '@react-native-async-storage/async-storage',
    name: 'Offline data storage',
    usedFor: 'Cars, addresses and orders available without a network',
    run: storageRoundTrip,
  },
  {
    id: 'otp',
    technology: 'OTP rules (app logic)',
    name: 'OTP verification rules',
    usedFor: 'Register and sign in securely',
    run: async () => {
      let now = 0;
      const svc = new LocalOtpService(() => now);
      const { code } = svc.request('50123456');
      const wrong = svc.verify('50123456', code === '000000' ? '111111' : '000000');
      if (wrong.ok) throw new Error('Accepted a wrong code');
      if (!svc.verify('50123456', code).ok) throw new Error('Rejected the right code');
      svc.request('50123456');
      now = OTP_TTL_MS + 1;
      const expired = svc.verify('50123456', code);
      if (expired.ok) throw new Error('Accepted an expired code');
      return 'Wrong code rejected, right code accepted, expired code rejected';
    },
  },
  {
    id: 'dial',
    technology: 'React Native Linking (tel:)',
    name: 'Phone dialer',
    usedFor: 'Call the provider or 999 from the Track Order screen',
    run: async () => {
      if (!(await canDial())) throw new Error('This device cannot place calls (expected on simulators and iPads)');
      return 'tel: links can be opened';
    },
  },
  {
    id: 'network',
    technology: 'fetch (HTTPS)',
    name: 'Network round trip',
    usedFor: 'Future backend calls (orders, provider matching, real OTP)',
    run: async () => {
      const t = Date.now();
      const res = await fetch('https://www.google.com/generate_204', { method: 'GET' });
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      return `HTTP ${res.status} in ${Date.now() - t} ms`;
    },
  },
  {
    id: 'haptics',
    technology: 'expo-haptics',
    name: 'Haptic feedback',
    usedFor: 'Confirm order placed and OTP success with a vibration',
    run: async () => {
      if (Platform.OS === 'web') throw new Error('No haptics in the browser');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return 'Success vibration triggered (feel it on a real phone)';
    },
  },
  {
    id: 'camera',
    technology: 'expo-image-picker (camera)',
    name: 'Camera',
    usedFor: 'Photo of the car or damage on the service screen',
    manual: true,
    run: async () => {
      const uri = await pickCarPhoto('camera');
      if (!uri) throw new Error('Cancelled');
      return 'Photo captured';
    },
  },
  {
    id: 'library',
    technology: 'expo-image-picker (library)',
    name: 'Photo library',
    usedFor: 'Attach an existing photo to a request',
    manual: true,
    run: async () => {
      const uri = await pickCarPhoto('library');
      if (!uri) throw new Error('Cancelled');
      return 'Photo selected';
    },
  },
];
