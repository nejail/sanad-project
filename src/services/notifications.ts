import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Local notifications are used for two things in the prototype:
 *  1. Delivering the OTP code (stands in for an SMS).
 *  2. Order status updates while the provider is on the way.
 * Remote push needs a development build and a push server, see the README.
 */
let configured = false;

export function configureNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'SANAD updates',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => undefined);
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Shows a notification after `seconds` (0 = immediately). Returns false if it could not be shown. */
export async function notify(title: string, body: string, seconds = 0): Promise<boolean> {
  try {
    configureNotifications();
    if (!(await ensureNotificationPermission())) return false;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger:
        seconds > 0
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false }
          : null,
    });
    return true;
  } catch {
    return false;
  }
}
