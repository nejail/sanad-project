import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Local notifications are used for two things in the prototype:
 *  1. Delivering the OTP code (stands in for an SMS).
 *  2. Order status updates while the provider is on the way.
 * Remote push needs a development build and a push server, see the README.
 */
let configured = false;

type PushLike = { trigger?: unknown; content: { data?: Record<string, unknown> | null } };

/** True for a push about an order (sent by the technician's phone), not for local notifications. */
export function isOrderPush(request: PushLike): boolean {
  const type = (request.trigger as { type?: string } | null | undefined)?.type;
  return type === 'push' && typeof request.content.data?.orderId === 'string';
}

/** True when one of these notifications is the push for this order and status. */
export function includesOrderPush(requests: PushLike[], orderId: string, status: string): boolean {
  return requests.some((r) => isOrderPush(r) && r.content.data?.orderId === orderId && r.content.data?.status === status);
}

/** True when the driver already got this update as a push while SANAD was closed (still listed, or just tapped). */
export async function pushAlreadyShown(orderId: string, status: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const shown = (await Notifications.getPresentedNotificationsAsync()).map((n) => n.request);
    const tapped = Notifications.getLastNotificationResponse()?.notification.request;
    return includesOrderPush(tapped ? [...shown, tapped] : shown, orderId, status);
  } catch {
    return false;
  }
}

export function configureNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    // While SANAD is open, OrderStatusWatcher announces order updates, so the push for the same update stays silent.
    handleNotification: async (n) => {
      const show = !isOrderPush(n.request);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
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
  } catch (e) {
    console.warn('[notifications] could not show notification', e);
    return false;
  }
}
