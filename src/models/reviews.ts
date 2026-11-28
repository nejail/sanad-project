/**
 * Rating the technician (V2 feature 14).
 *
 *   reviews/{orderId}    ReviewDoc, created once by the driver after the job is done
 *
 * The driver's phone never changes the technician's profile. It only creates the review, and the
 * rating the app shows is the average of the technician's reviews. The rules check the same things
 * as canReview below, on the server: the order is the driver's, it is done, and the technician on
 * the review is the one on the order. A second review of the same order is refused because the
 * document already exists and reviews cannot be updated.
 */
import { ReviewDoc } from './firestore';
import { Order } from './types';

export const MAX_COMMENT = 300;

export type Stars = ReviewDoc['stars'];

/** The technician's id on an order a real technician did, or null (simulated or Provider Mode test jobs). */
export function reviewedProviderId(order: Order): string | null {
  const id = order.provider.id;
  if (order.dispatch !== 'provider' || !id || id.startsWith('device:')) return null;
  return id;
}

/** Whether this driver can rate this order: their own, done, by a registered technician. */
export function canReview(order: Order, uid: string | null | undefined, customerId?: string): boolean {
  if (!uid) return false;
  if (customerId !== undefined && customerId !== uid) return false;
  return order.status === 'done' && reviewedProviderId(order) !== null;
}

export function isStars(n: unknown): n is Stars {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;
}

/** Builds the review document. Throws on stars outside 1 to 5 or an order that cannot be rated. */
export function buildReview(order: Order, uid: string, stars: number, comment: string, at = new Date().toISOString()): ReviewDoc {
  const providerId = reviewedProviderId(order);
  if (!providerId || order.status !== 'done') throw new Error('Only a finished job by a SANAD technician can be rated.');
  if (!isStars(stars)) throw new Error('Choose 1 to 5 stars.');
  const text = comment.trim().slice(0, MAX_COMMENT);
  return { orderId: order.id, providerId, customerId: uid, stars, comment: text || null, createdAt: at };
}

/**
 * The rating shown for a technician: the average of their reviews to one decimal, or the value on
 * their profile when they have none yet.
 */
export function averageRating(stars: number[], fallback: number): { rating: number; count: number } {
  const valid = stars.filter(isStars);
  if (!valid.length) return { rating: fallback, count: 0 };
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return { rating: Math.round(avg * 10) / 10, count: valid.length };
}
