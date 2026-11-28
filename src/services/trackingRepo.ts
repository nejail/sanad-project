/**
 * Live location of the technician on a job (V2 feature 7).
 *
 *   orders/{orderId}/tracking/live    TrackingDoc, written by the assigned technician every few seconds
 *   providers/{uid}                   lastLocation and geohash, updated in the same write
 *
 * The rules let only the assigned technician write the tracking document, and only the driver and
 * that technician read it.
 */
import { COLLECTIONS } from '../models/firestore';
import { LiveFix, encodeGeohash } from '../models/liveTracking';
import { Coordinates } from '../models/types';
import { FirestoreApi, toCoords, toIso } from './firestoreRepo';

/** Path of the live tracking document for an order. */
export const livePath = (orderId: string) => `${COLLECTIONS.tracking(orderId)}/live`;

/** Reads orders/{id}/tracking/live into a LiveFix (null when missing or without a location). */
export function decodeTracking(data: Record<string, unknown> | null): LiveFix | null {
  if (!data || !data.location) return null;
  return {
    coords: toCoords(data.location),
    heading: typeof data.heading === 'number' ? data.heading : null,
    etaMin: typeof data.etaMin === 'number' ? data.etaMin : null,
    updatedAt: toIso(data.updatedAt),
  };
}

export class TrackingRepo {
  constructor(private api: FirestoreApi) {}

  /**
   * Publishes the technician's position for an order, and keeps their profile's lastLocation and
   * geohash up to date (used by matching), in one batch.
   */
  async publish(orderId: string, providerId: string, coords: Coordinates, etaMin: number | null, heading: number | null = null, at = new Date().toISOString()): Promise<void> {
    const point = this.api.geoPoint(coords.latitude, coords.longitude);
    await this.api.commit([
      { kind: 'set', path: livePath(orderId), data: { location: point, heading, etaMin, updatedAt: this.api.timestamp(at) } },
      { kind: 'update', path: `${COLLECTIONS.providers}/${providerId}`, data: { lastLocation: point, geohash: encodeGeohash(coords) } },
    ]);
  }

  /** Live position for the driver's Track Order. Returns the unsubscribe function. */
  listen(orderId: string, next: (fix: LiveFix | null) => void, error: (e: Error) => void): () => void {
    return this.api.onDoc(livePath(orderId), (d) => next(decodeTracking(d)), error);
  }
}
