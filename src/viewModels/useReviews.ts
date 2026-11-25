import { useEffect, useMemo, useState } from 'react';
import { ReviewDoc } from '../models/firestore';
import { averageRating, buildReview, canReview, reviewedProviderId } from '../models/reviews';
import { Order } from '../models/types';
import { getFirestoreApi } from '../services/firestoreRepo';
import { providerMessage } from '../services/providerRepo';
import { ReviewsRepo } from '../services/reviewsRepo';
import { useApp } from './AppContext';

/** Reviews are only in Firestore, so only in the development build. */
function useRepo(): ReviewsRepo | null {
  const { dataSource } = useApp();
  return useMemo(() => (dataSource === 'firestore' ? new ReviewsRepo(getFirestoreApi()) : null), [dataSource]);
}

/**
 * Driver's side of V2 feature 14: whether this order can be rated, the review once it exists, and
 * submit(). Used by the "Rate your technician" card on Track Order and My Orders.
 */
export function useOrderReview(order: Order | undefined) {
  const { uid } = useApp();
  const repo = useRepo();
  const [review, setReview] = useState<ReviewDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible = !!repo && !!order && canReview(order, uid);

  useEffect(() => {
    if (!repo || !order || !eligible) return;
    setLoaded(false);
    return repo.listenOrder(order.id, (r) => { setReview(r); setLoaded(true); }, (e) => { setError(providerMessage(e)); setLoaded(true); });
  }, [repo, order?.id, eligible]);

  async function submit(stars: number, comment: string): Promise<boolean> {
    if (!repo || !order || !uid) return false;
    setBusy(true);
    setError(null);
    try {
      await repo.create(buildReview(order, uid, stars, comment));
      return true;
    } catch (e) {
      const msg = providerMessage(e);
      setError(/permission/i.test(String((e as Error)?.message)) ? 'This job was already rated, or it cannot be rated.' : msg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { eligible, loaded, review, busy, error, submit };
}

/**
 * The rating shown for a technician (Track Order, Provider Mode): the average of their reviews,
 * live, or the profile value when there are none or outside the development build.
 */
export function useProviderRating(providerId: string | null | undefined, fallback: number): { rating: number; count: number } {
  const repo = useRepo();
  const [stars, setStars] = useState<number[]>([]);

  useEffect(() => {
    setStars([]);
    if (!repo || !providerId || providerId.startsWith('device:')) return;
    return repo.listenProvider(providerId, setStars, () => setStars([]));
  }, [repo, providerId]);

  return averageRating(stars, fallback);
}

/** Convenience for an order: the rating of the technician who did it. */
export function useOrderProviderRating(order: Order | undefined) {
  return useProviderRating(order ? reviewedProviderId(order) : null, order?.provider.rating ?? 0);
}
