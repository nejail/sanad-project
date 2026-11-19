/**
 * The driver's orders in Cloud Firestore (V2 feature 5).
 *
 *   orders/{orderId}    OrderDoc, created by the driver with providerId: null
 *
 * The driver's phone creates the order once, then only updates the fields it is allowed to change
 * (status of a simulated job, the car photo, who the job is offered to). A technician's acceptance
 * and steps come back through listenMine, so Track Order, the Accepted card and the notifications
 * follow the technician with no screen changes.
 */
import { COLLECTIONS, OrderDoc, orderToDoc } from '../models/firestore';
import { driverFields } from '../models/orders';
import { Order, StatusChange } from '../models/types';
import { FirestoreApi } from './firestoreRepo';
import { decodeOrder } from './providerRepo';

/** OrderDoc ready for Firestore: locations as GeoPoints and times as Timestamps. */
export function encodeOrder(api: Pick<FirestoreApi, 'geoPoint' | 'timestamp'>, doc: OrderDoc): Record<string, unknown> {
  const ts = (iso: string | null | undefined) => (iso ? api.timestamp(iso) : null);
  return {
    ...doc,
    address: { ...doc.address, location: api.geoPoint(doc.address.location.latitude, doc.address.location.longitude) },
    towTo: doc.towTo ? { ...doc.towTo, location: api.geoPoint(doc.towTo.location.latitude, doc.towTo.location.longitude) } : null,
    statusHistory: doc.statusHistory.map((h) => ({ status: h.status, at: api.timestamp(h.at) })),
    createdAt: api.timestamp(doc.createdAt),
    updatedAt: api.timestamp(doc.updatedAt),
    acceptedAt: ts(doc.acceptedAt),
    offeredAt: ts(doc.offeredAt),
  };
}

/** The fields a driver may change, as plain values (ISO dates); encoded by OrdersRepo.update. */
export interface DriverOrderUpdate {
  status?: Order['status'];
  statusHistory?: StatusChange[];
  photoPath?: string;
  photoUrl?: string;
  notes?: string;
  offeredTo?: string | null;
  offeredAt?: string | null;
  offeredBefore?: string[];
}

export class OrdersRepo {
  constructor(private api: FirestoreApi) {}

  private orderPath = (id: string) => `${COLLECTIONS.orders}/${id}`;

  /** Creates orders/{order.id} for this driver. No technician yet, so providerId is null (the rules require it). */
  async create(order: Order, uid: string): Promise<void> {
    const doc = orderToDoc(order, uid, null);
    await this.api.commit([{ kind: 'set', path: this.orderPath(order.id), data: encodeOrder(this.api, doc) }]);
  }

  /**
   * Updates only the fields a driver may change (never `set` after placing, so a technician's
   * acceptance is never overwritten). updatedAt is added. Fields outside the allowed list are dropped.
   */
  async update(orderId: string, fields: DriverOrderUpdate, at = new Date().toISOString()): Promise<void> {
    const data: Record<string, unknown> = driverFields({ ...fields });
    if (fields.statusHistory) data.statusHistory = fields.statusHistory.map((h) => ({ status: h.status, at: this.api.timestamp(h.at) }));
    if (fields.offeredAt !== undefined) data.offeredAt = fields.offeredAt ? this.api.timestamp(fields.offeredAt) : null;
    data.updatedAt = this.api.timestamp(at);
    await this.api.commit([{ kind: 'update', path: this.orderPath(orderId), data }]);
  }

  /** Live list of this driver's orders, newest first. */
  listenMine(uid: string, next: (orders: Order[]) => void, error: (e: Error) => void): () => void {
    return this.api.onQuery(
      COLLECTIONS.orders,
      [['customerId', '==', uid]],
      (docs) => next(docs.map((d) => decodeOrder(d.id, d.data)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      error,
    );
  }
}
