import { useEffect, useState } from 'react';
import { LiveFix } from '../models/liveTracking';
import { Order } from '../models/types';
import { getFirestoreApi } from '../services/firestoreRepo';
import { TrackingRepo } from '../services/trackingRepo';
import { useApp } from './AppContext';

/**
 * Driver's Track Order (V2 feature 7): the technician's live position for an order sent to a real
 * technician, from orders/{id}/tracking/live. Null for simulated orders, on the phone only (Expo Go),
 * and until the technician sets off and shares their location.
 */
export function useLiveTracking(order: Order | undefined): LiveFix | null {
  const { dataSource } = useApp();
  const [fix, setFix] = useState<LiveFix | null>(null);
  const watching = dataSource === 'firestore' && !!order && order.dispatch === 'provider'
    && (order.status === 'accepted' || order.status === 'on_the_way' || order.status === 'arrived');

  useEffect(() => {
    if (!watching || !order) {
      setFix(null);
      return;
    }
    const stop = new TrackingRepo(getFirestoreApi()).listen(order.id, setFix, (e) => console.warn('[tracking] live position', e));
    return () => stop();
  }, [watching, order?.id]);

  return fix;
}
