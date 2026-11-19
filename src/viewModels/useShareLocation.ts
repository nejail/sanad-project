import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { liveEtaMin, shouldPublish } from '../models/liveTracking';
import { Order } from '../models/types';
import { getFirestoreApi } from '../services/firestoreRepo';
import { ensureLocationPermission } from '../services/location';
import { providerMessage } from '../services/providerRepo';
import { TrackingRepo } from '../services/trackingRepo';
import { useApp } from './AppContext';

/**
 * Technician's phone (V2 feature 7): while a job is On the way, watches the phone's location in the
 * foreground and publishes it every few seconds, so the driver's Track Order moves the van for real.
 * Only for a registered technician on their own job in the development build; otherwise it does nothing.
 * ProviderJobView calls it with one line.
 */
export function useShareLocation(order: Order | undefined): { sharing: boolean; error: string | null } {
  const { uid, dataSource } = useApp();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = dataSource === 'firestore' && !!uid && !!order && order.status === 'on_the_way' && order.provider.id === uid;

  useEffect(() => {
    if (!active || !order || !uid) return;
    const repo = new TrackingRepo(getFirestoreApi());
    const dest = order.address.coords;
    let sub: Location.LocationSubscription | null = null;
    let stopped = false;
    let lastAt: number | null = null;

    (async () => {
      if (!(await ensureLocationPermission())) {
        setError('Allow location access so the driver can see you coming.');
        return;
      }
      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 10 },
        (loc) => {
          const now = Date.now();
          if (!shouldPublish(lastAt, now)) return;
          lastAt = now;
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          const heading = typeof loc.coords.heading === 'number' && loc.coords.heading >= 0 ? loc.coords.heading : null;
          repo.publish(order.id, uid, coords, liveEtaMin(coords, dest), heading)
            .then(() => { setSharing(true); setError(null); })
            .catch((e) => setError(providerMessage(e)));
        },
      );
      if (stopped) watcher.remove();
      else sub = watcher;
    })().catch((e) => setError((e as Error).message));

    return () => {
      stopped = true;
      sub?.remove();
      setSharing(false);
    };
  }, [active, order?.id, uid]);

  return { sharing, error };
}
