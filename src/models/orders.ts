/**
 * Orders shared between the phone and Cloud Firestore (V2 feature 5). Pure logic only, so it is
 * easy to test: order numbers, which fields a driver may change, and how a Firestore copy of an
 * order is merged with the one kept on the phone.
 */
import { Order } from './types';

/** Fields the driver's phone may change on an order once it is placed (see firebase/firestore.rules). */
export const DRIVER_ORDER_FIELDS = [
  'status', 'statusHistory', 'updatedAt', 'photoPath', 'photoUrl', 'notes', 'offeredTo', 'offeredAt', 'offeredBefore',
] as const;
export type DriverOrderField = (typeof DRIVER_ORDER_FIELDS)[number];

/** Reads the running number out of an order id: "SND-1043" and "SND-1043-K7QF" both give 1043. */
export function orderNumber(id: string): number {
  const m = /^SND-(\d+)/.exec(id);
  return m ? Number(m[1]) : 0;
}

/**
 * The id for the driver's next order. Orders live in one shared `orders` collection, so in the
 * development build the id ends with four characters of the driver's user id ("SND-1043-K7QF"):
 * two drivers can then never write to the same document. On the phone only, it stays "SND-1043".
 */
export function nextOrderId(orders: Pick<Order, 'id'>[], userId?: string | null): string {
  const n = Math.max(1042, ...orders.map((o) => orderNumber(o.id))) + 1;
  const tag = (userId ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
  return tag ? `SND-${n}-${tag}` : `SND-${n}`;
}

/** Keeps only the fields a driver may write, so an update never touches the technician's fields. */
export function driverFields(fields: Record<string, unknown>): Record<string, unknown> {
  const allowed = DRIVER_ORDER_FIELDS as readonly string[];
  return Object.fromEntries(Object.entries(fields).filter(([k, v]) => allowed.includes(k) && v !== undefined));
}

/** Number of recorded status changes (an order with no history counts as one). */
const steps = (o: Order) => o.statusHistory?.length ?? 1;

/**
 * Merges the driver's orders from Firestore into the ones on the phone.
 *
 *  - Simulated orders are moved along by this phone, so the phone's copy wins.
 *  - Orders sent to technicians follow Firestore (the technician's details, status and times),
 *    unless the phone is already further along (Provider Mode tested on one phone). Details that
 *    Firestore does not store, such as the garage the van starts from and the local photo, are kept.
 *  - Orders that only exist on the phone (placed before this version, or offline) stay.
 *
 * Returns the list newest first.
 */
export function mergeOrders(local: Order[], remote: Order[]): Order[] {
  const byId = new Map(local.map((o) => [o.id, o]));
  const merged = new Map(byId);
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l) {
      merged.set(r.id, r);
      continue;
    }
    if ((l.dispatch ?? 'simulated') !== 'provider' || steps(l) > steps(r)) continue;
    merged.set(r.id, {
      ...r,
      photoUri: l.photoUri,
      provider: { ...r.provider, base: l.provider.base, etaMin: l.provider.etaMin },
    });
  }
  return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** True when two order lists show the same thing, so the screen does not redraw for nothing. */
export function sameOrders(a: Order[], b: Order[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}
