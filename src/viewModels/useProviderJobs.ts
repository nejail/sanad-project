import { useEffect, useMemo, useState } from 'react';
import { ProviderProfile, myJobs, openJobsFor, providerOnOrder } from '../models/providerJobs';
import { statusNotification } from '../models/tracking';
import { Order, OrderStatus } from '../models/types';
import { getFirestoreApi } from '../services/firestoreRepo';
import { ProviderRepo, offers, providerMessage } from '../services/providerRepo';
import { sendPush } from '../services/push';
import { useAccount, useApp } from './AppContext';

/**
 * Provider Mode (V2 feature 4). Two sources of jobs:
 *  - 'firestore': this user is a registered technician (providers/{uid}) in the development build.
 *    They see every order no one has accepted yet, live, and the jobs they took.
 *  - 'device': anyone else (Expo Go, or a number that is not a technician). Provider Mode then works
 *    as a test on one phone with this account's own orders that were sent to Provider Mode.
 */
export function useProviderJobs() {
  const { uid, dataSource, acceptOrderOnDevice, setOrderStatus } = useApp();
  const account = useAccount();
  const repo = useMemo(() => (dataSource === 'firestore' ? new ProviderRepo(getFirestoreApi()) : null), [dataSource]);

  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [checking, setChecking] = useState(!!repo);
  const [remoteOpen, setRemoteOpen] = useState<Order[]>([]);
  const [remoteMine, setRemoteMine] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Is this user a registered technician?
  useEffect(() => {
    if (!repo || !uid) return;
    let cancelled = false;
    setChecking(true);
    repo.loadProfile(uid)
      .then((p) => !cancelled && setProfile(p))
      .catch((e) => !cancelled && setError(providerMessage(e)))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [repo, uid]);

  // Live jobs for a registered technician.
  useEffect(() => {
    if (!repo || !profile) return;
    const fail = (e: Error) => setError(providerMessage(e));
    const stops = [repo.listenOpenJobs(setRemoteOpen, fail), repo.listenMyJobs(profile.id, setRemoteMine, fail)];
    return () => stops.forEach((stop) => stop());
  }, [repo, profile?.id]);

  const source: 'firestore' | 'device' = repo && profile ? 'firestore' : 'device';

  // Test profile for Provider Mode on one phone (not verified: it is not in the providers collection).
  const deviceProfile: ProviderProfile = useMemo(() => ({
    id: `device:${account.user.phone}`,
    name: account.user.name ? `${account.user.name} (test technician)` : 'Test technician',
    businessName: 'Provider Mode test',
    phone: account.user.phone,
    vehicle: 'Service van',
    vehiclePlate: 'TEST',
    rating: 5,
    services: [],
    isOnline: true,
    verified: false,
  }), [account.user.phone, account.user.name]);

  const deviceOrders = account.orders.filter((o) => o.dispatch === 'provider');
  const activeProfile = source === 'firestore' ? profile! : deviceProfile;
  const open = source === 'firestore' ? openJobsFor(remoteOpen, offers(profile)) : openJobsFor(deviceOrders);
  const mine = source === 'firestore' ? myJobs(remoteMine, activeProfile.id) : myJobs(deviceOrders, deviceProfile.id);

  /** Tells the driver's phone about the change when it is closed (no-op without a push token). */
  const pushToDriver = (order: Order, status: OrderStatus) => {
    const message = statusNotification(order, status);
    if (message) sendPush(order.customerPushToken, message.title, message.body, { orderId: order.id, status });
  };

  /** Accepts a job. Throws with a readable message when it failed (e.g. taken by someone else). */
  async function accept(order: Order): Promise<void> {
    if (source === 'device') {
      acceptOrderOnDevice(order.id, providerOnOrder(deviceProfile));
      return;
    }
    try {
      const accepted = await repo!.accept(order, activeProfile);
      pushToDriver(accepted, 'accepted');
    } catch (e) {
      throw new Error(providerMessage(e));
    }
  }

  /** Moves an accepted job to its next status. */
  async function advance(order: Order, to: OrderStatus): Promise<void> {
    if (source === 'device') {
      setOrderStatus(order.id, to);
      return;
    }
    try {
      const next = await repo!.advance(order, to);
      pushToDriver(next, to);
    } catch (e) {
      throw new Error(providerMessage(e));
    }
  }

  const find = (id: string) => [...open, ...mine].find((o) => o.id === id);

  return {
    source,
    checking,
    /** Development build, but this number is not in the providers collection. */
    notRegistered: !!repo && !checking && !profile,
    profile: activeProfile,
    open,
    mine,
    error,
    accept,
    advance,
    find,
  };
}
