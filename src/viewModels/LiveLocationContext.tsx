import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { activeSharingJob } from '../models/liveTracking';
import { Order } from '../models/types';
import { getFirestoreApi } from '../services/firestoreRepo';
import { ProviderRepo } from '../services/providerRepo';
import { useApp } from './AppContext';
import { useShareLocation } from './useShareLocation';

interface LiveLocationState {
  /** The order whose location is being shared, if any. */
  orderId: string | null;
  sharing: boolean;
  error: string | null;
}

const LiveLocationContext = createContext<LiveLocationState>({ orderId: null, sharing: false, error: null });

/**
 * Technician's phone (V2 feature 7): shares the live location for their job that is On the way,
 * wherever they are in the app, not only while the job screen is open. It listens to the jobs this
 * user accepted (orders where providerId is their uid), so for a driver it finds nothing and does
 * nothing. Location is only watched while SANAD is in the foreground: it stops when the phone is
 * locked or the app is in the background.
 */
export function LiveLocationProvider({ children }: { children: React.ReactNode }) {
  const { uid, dataSource } = useApp();
  const repo = useMemo(() => (dataSource === 'firestore' ? new ProviderRepo(getFirestoreApi()) : null), [dataSource]);
  const [jobs, setJobs] = useState<Order[]>([]);

  useEffect(() => {
    setJobs([]);
    if (!repo || !uid) return;
    return repo.listenMyJobs(uid, setJobs, () => setJobs([]));
  }, [repo, uid]);

  const active = activeSharingJob(jobs, uid);
  const { sharing, error } = useShareLocation(active);
  const value = useMemo(() => ({ orderId: active?.id ?? null, sharing, error }), [active?.id, sharing, error]);
  return <LiveLocationContext.Provider value={value}>{children}</LiveLocationContext.Provider>;
}

/** Whether this phone is sharing its location, and for which order. */
export function useLiveLocation(): LiveLocationState {
  return useContext(LiveLocationContext);
}
