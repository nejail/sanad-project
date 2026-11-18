/**
 * Remote push for order status changes (V2 feature 12), so the driver hears about acceptance and
 * arrival with the app closed. The driver's phone registers an Expo push token and stores it on the
 * order; the technician's phone sends the message through Expo's push service when they accept or
 * arrive, so no separate server is needed.
 *
 * iOS only issues a token to builds signed with a paid Apple Developer account (push entitlement,
 * see SANAD_PUSH in app.config.ts) and an EAS project id. Without them the token is null and the
 * driver still gets in-app notifications while SANAD is open.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** The EAS project id the push token is issued for, if the app has one configured. */
function projectId(): string | undefined {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  return fromConfig ?? Constants.easConfig?.projectId ?? undefined;
}

/** Asks for this phone's Expo push token. Returns null when push is not available on this build. */
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const id = projectId();
  if (!id) return null;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return token.data;
  } catch (e) {
    console.warn('[push] no push token on this build', e);
    return null;
  }
}

/** The message body Expo's push service expects. */
export function pushMessage(token: string, title: string, body: string, data: Record<string, unknown> = {}) {
  return { to: token, title, body, sound: 'default', priority: 'high', data };
}

/** Sends one push message. Returns false (and never throws) when it could not be sent. */
export async function sendPush(token: string | undefined, title: string, body: string, data?: Record<string, unknown>): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(pushMessage(token, title, body, data)),
    });
    return res.ok;
  } catch (e) {
    console.warn('[push] could not send', e);
    return false;
  }
}
