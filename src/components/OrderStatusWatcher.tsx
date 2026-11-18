import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { statusNotification } from '../models/tracking';
import { OrderStatus } from '../models/types';
import { notify } from '../services/notifications';
import { useApp } from '../viewModels/AppContext';

/**
 * Notifies the driver when a technician accepts, sets off and arrives (V2 feature 12), wherever the
 * driver is in the app. It watches the orders for status changes, so it works the same for the
 * simulation, Provider Mode on this phone, and orders updated from Firestore.
 * Statuses already there when the account loads are not announced again.
 */
export function OrderStatusWatcher() {
  const { account, status } = useApp();
  const seen = useRef<Map<string, OrderStatus> | null>(null);

  useEffect(() => {
    if (status !== 'signedIn' || !account) {
      seen.current = null;
      return;
    }
    const first = seen.current === null;
    const known = seen.current ?? new Map<string, OrderStatus>();
    for (const order of account.orders) {
      const before = known.get(order.id);
      known.set(order.id, order.status);
      if (first || before === undefined || before === order.status) continue;
      const message = statusNotification(order, order.status, order.provider.etaMin);
      if (!message) continue;
      notify(message.title, message.body);
      if (order.status === 'accepted') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    seen.current = known;
  }, [account?.orders, status]);

  return null;
}
