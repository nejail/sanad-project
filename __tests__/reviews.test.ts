import { buildQuote } from '../src/models/pricing';
import { activeSharingJob } from '../src/models/liveTracking';
import { averageRating, buildReview, canReview, isStars, reviewedProviderId } from '../src/models/reviews';
import { Order } from '../src/models/types';
import { ReviewsRepo, decodeReview, reviewPath } from '../src/services/reviewsRepo';
import { FakeFirestore, FakeTimestamp } from './fakeFirestore';

const T0 = '2026-11-25T10:00:00.000Z';
const tech = { name: 'Test Technician 1', rating: 4.5, vehicle: 'Service van', phone: '+97455550123', id: 'prov-1', verified: true };

/** A job done by a registered technician unless the patch says otherwise. */
function order(id: string, patch: Partial<Order> = {}): Order {
  return {
    id, serviceId: 'battery', optionId: 'jump', title: 'Battery Jump Start', carId: 'car-1', carLabel: 'Land Cruiser · 12345',
    address: { id: 'current', label: 'Current location', line: 'CMU-Q car park', coords: { latitude: 25.31, longitude: 51.44 }, isDefault: false },
    schedule: { kind: 'asap' }, quote: buildQuote({ serviceId: 'battery', optionId: 'jump' }), payment: 'cash',
    status: 'done', statusHistory: [{ status: 'confirmed', at: T0 }], createdAt: T0,
    provider: tech, dispatch: 'provider',
    ...patch,
  };
}

describe('who can rate a job (V2 feature 14, same checks as the rules)', () => {
  it('lets the driver rate a done job by a registered technician', () => {
    expect(canReview(order('SND-1'), 'cust-1')).toBe(true);
    expect(reviewedProviderId(order('SND-1'))).toBe('prov-1');
  });
  it('refuses jobs that are not done, simulated, or Provider Mode tests on one phone', () => {
    expect(canReview(order('SND-1', { status: 'on_the_way' }), 'cust-1')).toBe(false);
    expect(canReview(order('SND-1', { dispatch: 'simulated' }), 'cust-1')).toBe(false);
    expect(canReview(order('SND-1', { provider: { ...tech, id: 'device:50123456' } }), 'cust-1')).toBe(false);
    expect(canReview(order('SND-1', { provider: { ...tech, id: undefined } }), 'cust-1')).toBe(false);
  });
  it('refuses a signed-out user or someone else\'s order', () => {
    expect(canReview(order('SND-1'), null)).toBe(false);
    expect(canReview(order('SND-1'), 'cust-2', 'cust-1')).toBe(false);
    expect(canReview(order('SND-1'), 'cust-1', 'cust-1')).toBe(true);
  });
});

describe('review document', () => {
  it('uses the order, the technician on it and the driver', () => {
    expect(buildReview(order('SND-1'), 'cust-1', 4, '  Quick and friendly  ', T0)).toEqual({
      orderId: 'SND-1', providerId: 'prov-1', customerId: 'cust-1', stars: 4, comment: 'Quick and friendly', createdAt: T0,
    });
  });
  it('stores an empty comment as null and cuts long ones', () => {
    expect(buildReview(order('SND-1'), 'cust-1', 5, '   ', T0).comment).toBeNull();
    expect(buildReview(order('SND-1'), 'cust-1', 5, 'x'.repeat(400), T0).comment).toHaveLength(300);
  });
  it('only takes whole stars from 1 to 5', () => {
    expect(isStars(3)).toBe(true);
    expect([0, 6, 2.5, '4'].some(isStars)).toBe(false);
    expect(() => buildReview(order('SND-1'), 'cust-1', 6, '', T0)).toThrow('1 to 5');
    expect(() => buildReview(order('SND-1', { status: 'arrived' }), 'cust-1', 5, '', T0)).toThrow('finished');
  });
});

describe('technician rating', () => {
  it('is the average of their reviews to one decimal', () => {
    expect(averageRating([5, 4, 4], 4.9)).toEqual({ rating: 4.3, count: 3 });
    expect(averageRating([5], 3)).toEqual({ rating: 5, count: 1 });
  });
  it('falls back to the profile value with no reviews', () => {
    expect(averageRating([], 4.9)).toEqual({ rating: 4.9, count: 0 });
    expect(averageRating([0, 9], 4.9)).toEqual({ rating: 4.9, count: 0 });
  });
});

describe('ReviewsRepo', () => {
  it('writes reviews/{orderId} with a timestamp and reads it back', async () => {
    const db = new FakeFirestore();
    const repo = new ReviewsRepo(db);
    await repo.create(buildReview(order('SND-1'), 'cust-1', 5, 'Great', T0));
    const stored = db.docs.get(reviewPath("SND-1"))!;
    expect(stored.createdAt).toBeInstanceOf(FakeTimestamp);
    expect(decodeReview(stored)).toEqual({ orderId: 'SND-1', providerId: 'prov-1', customerId: 'cust-1', stars: 5, comment: 'Great', createdAt: T0 });
  });
  it('lists the stars of one technician only, live', async () => {
    const db = new FakeFirestore();
    const repo = new ReviewsRepo(db);
    const seen: number[][] = [];
    const stop = repo.listenProvider('prov-1', (s) => seen.push(s), () => undefined);
    await repo.create(buildReview(order('SND-1'), 'cust-1', 5, '', T0));
    await repo.create(buildReview(order('SND-2', { provider: { ...tech, id: 'prov-2' } }), 'cust-1', 2, '', T0));
    await repo.create(buildReview(order('SND-3'), 'cust-2', 3, '', T0));
    expect(seen[seen.length - 1].sort()).toEqual([3, 5]);
    stop();
  });
  it('ignores malformed documents', () => {
    expect(decodeReview(null)).toBeNull();
    expect(decodeReview({ stars: 7, providerId: 'p' })).toBeNull();
  });
});

describe('live location runs for the technician\'s active job (V2 feature 7)', () => {
  it('picks their own job that is On the way', () => {
    const jobs = [order('SND-1', { status: 'accepted' }), order('SND-2', { status: 'on_the_way' }), order('SND-3', { status: 'on_the_way', provider: { ...tech, id: 'prov-2' } })];
    expect(activeSharingJob(jobs, 'prov-1')?.id).toBe('SND-2');
    expect(activeSharingJob(jobs, 'prov-2')?.id).toBe('SND-3');
    expect(activeSharingJob(jobs, 'cust-1')).toBeUndefined();
    expect(activeSharingJob(jobs, null)).toBeUndefined();
  });
});
