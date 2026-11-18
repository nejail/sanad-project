/**
 * Provider side in Cloud Firestore (V2 feature 4).
 *
 *   providers/{uid}     ProviderDoc: who is a technician (added by an admin, see scripts/add-provider.ts)
 *   orders/{orderId}    OrderDoc: the technician sees orders with no provider, accepts one,
 *                       then moves it along: on the way, arrived, done.
 *
 * Accepting writes providerId, the technician's details and the Accepted status together. The
 * security rules only allow that while providerId is still null, so if two technicians accept the
 * same job at once, the second write is refused and they are told the job was taken.
 */
import { COLLECTIONS, OrderDoc, ProviderDoc, orderFromDoc, providerToOrderDoc } from '../models/firestore';
import { ProviderProfile, acceptJob, advanceJob } from '../models/providerJobs';
import { Order, OrderStatus, ServiceId } from '../models/types';
import { FirestoreApi, toCoords, toIso } from './firestoreRepo';

/** Reads an orders/{orderId} document (with Firestore Timestamps and GeoPoints) into an Order. */
export function decodeOrder(id: string, data: Record<string, unknown>): Order {
  const d = data as unknown as OrderDoc;
  const address = (d.address ?? {}) as OrderDoc['address'];
  return orderFromDoc(id, {
    ...d,
    address: { ...address, location: toCoords(address.location) },
    towTo: d.towTo ? { ...d.towTo, location: toCoords(d.towTo.location) } : null,
    statusHistory: (d.statusHistory ?? []).map((h) => ({ status: h.status, at: toIso(h.at) })),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    acceptedAt: d.acceptedAt ? toIso(d.acceptedAt) : null,
    schedule: d.schedule ?? { kind: 'asap', date: null, time: null },
    car: d.car ?? { id: '', label: 'Car' },
    payment: d.payment ?? { method: 'cash', status: 'unpaid' },
  });
}

/** Reads providers/{uid} into a profile. */
export function decodeProvider(id: string, data: Record<string, unknown>): ProviderProfile {
  const d = data as unknown as ProviderDoc;
  return {
    id,
    name: String(d.name ?? 'Technician'),
    businessName: String(d.businessName ?? ''),
    phone: String(d.phone ?? ''),
    vehicle: String(d.vehicle ?? ''),
    vehiclePlate: d.vehiclePlate ? String(d.vehiclePlate) : undefined,
    rating: Number(d.rating) || 0,
    services: Array.isArray(d.services) ? d.services : [],
    isOnline: d.isOnline === true,
    verified: true,
  };
}

/** Turns Firestore errors on the provider screens into a short message. */
export function providerMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'This job was taken by another technician, or your account cannot change it.';
  if (code.includes('not-found')) return 'This job no longer exists.';
  if (code.includes('unavailable')) return 'No connection. Try again when you are back online.';
  return (error as Error)?.message || 'Something went wrong. Try again.';
}

export class ProviderRepo {
  constructor(private api: FirestoreApi) {}

  private orderPath = (id: string) => `${COLLECTIONS.orders}/${id}`;

  /** The technician profile for this user, or null when they are not registered as a provider. */
  async loadProfile(uid: string): Promise<ProviderProfile | null> {
    const data = await this.api.getDoc(`${COLLECTIONS.providers}/${uid}`);
    return data ? decodeProvider(uid, data) : null;
  }

  /** Live list of orders sent to providers that no technician has accepted yet (simulated orders are left out). */
  listenOpenJobs(next: (orders: Order[]) => void, error: (e: Error) => void): () => void {
    return this.api.onQuery(
      COLLECTIONS.orders,
      [['dispatch', '==', 'provider'], ['providerId', '==', null], ['status', '==', 'confirmed']],
      (docs) => next(docs.map((d) => decodeOrder(d.id, d.data))),
      error,
    );
  }

  /** Live list of the orders this technician accepted. */
  listenMyJobs(uid: string, next: (orders: Order[]) => void, error: (e: Error) => void): () => void {
    return this.api.onQuery(COLLECTIONS.orders, [['providerId', '==', uid]], (docs) => next(docs.map((d) => decodeOrder(d.id, d.data))), error);
  }

  /** Accepts a job: the technician's details, the Accepted status and its time, in one write. */
  async accept(order: Order, profile: ProviderProfile, at = new Date().toISOString()): Promise<Order> {
    const accepted = acceptJob(order, profile, at);
    await this.api.commit([{
      kind: 'update',
      path: this.orderPath(order.id),
      data: {
        providerId: profile.id,
        provider: providerToOrderDoc(accepted.provider),
        status: 'accepted',
        acceptedAt: this.api.timestamp(at),
        statusHistory: this.history(accepted),
        updatedAt: this.api.timestamp(at),
      },
    }]);
    return accepted;
  }

  /** Moves an accepted job one step along (on the way, arrived, done) and records when. */
  async advance(order: Order, to: OrderStatus, at = new Date().toISOString()): Promise<Order> {
    const next = advanceJob(order, to, at);
    await this.api.commit([{
      kind: 'update',
      path: this.orderPath(order.id),
      data: { status: to, statusHistory: this.history(next), updatedAt: this.api.timestamp(at) },
    }]);
    return next;
  }

  /** Marks the technician as available (or not) for new jobs. */
  async setOnline(uid: string, isOnline: boolean): Promise<void> {
    await this.api.commit([{ kind: 'update', path: `${COLLECTIONS.providers}/${uid}`, data: { isOnline } }]);
  }

  private history(order: Order) {
    return (order.statusHistory ?? []).map((h) => ({ status: h.status, at: this.api.timestamp(h.at) }));
  }
}

/** Services a profile offers, or every service when the profile does not list any. */
export const offers = (p: ProviderProfile | null): ServiceId[] | undefined => (p?.services.length ? p.services : undefined);
