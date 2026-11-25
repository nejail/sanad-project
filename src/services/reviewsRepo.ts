/**
 * Reviews in Cloud Firestore (V2 feature 14). One document per order, with the order id as its id.
 * See src/models/reviews.ts for what the rules check.
 */
import { COLLECTIONS, ReviewDoc } from '../models/firestore';
import { isStars } from '../models/reviews';
import { FirestoreApi, toIso } from './firestoreRepo';

export const reviewPath = (orderId: string) => `${COLLECTIONS.reviews}/${orderId}`;

/** Reads a review document (null when missing or malformed). */
export function decodeReview(data: Record<string, unknown> | null): ReviewDoc | null {
  if (!data || !isStars(data.stars) || typeof data.providerId !== 'string') return null;
  return {
    orderId: String(data.orderId ?? ''),
    providerId: data.providerId,
    customerId: String(data.customerId ?? ''),
    stars: data.stars,
    comment: typeof data.comment === 'string' ? data.comment : null,
    createdAt: toIso(data.createdAt),
  };
}

export class ReviewsRepo {
  constructor(private api: FirestoreApi) {}

  /** Creates reviews/{orderId}. The rules refuse it if the order is not the driver's and done, or if it was already rated. */
  async create(review: ReviewDoc): Promise<void> {
    await this.api.commit([{
      kind: 'set',
      path: reviewPath(review.orderId),
      data: { ...review, createdAt: this.api.timestamp(review.createdAt) },
    }]);
  }

  /** The review of one order, live (null until it is rated). */
  listenOrder(orderId: string, next: (review: ReviewDoc | null) => void, error: (e: Error) => void): () => void {
    return this.api.onDoc(reviewPath(orderId), (d) => next(decodeReview(d)), error);
  }

  /** Stars of every review of one technician, live. */
  listenProvider(providerId: string, next: (stars: number[]) => void, error: (e: Error) => void): () => void {
    return this.api.onQuery(COLLECTIONS.reviews, [['providerId', '==', providerId]],
      (docs) => next(docs.map((d) => decodeReview(d.data)?.stars).filter((s): s is ReviewDoc['stars'] => !!s)), error);
  }
}
