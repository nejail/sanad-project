import { Route } from '../src/api/osm';
import { buildQuote } from '../src/models/pricing';
import { Coordinates, Order } from '../src/models/types';
import {
  MatchProvider, OFFER_TIMEOUT_MS, decodeMatchProvider, dispatchFor, eligibleProviders, isWaitingForProvider, listenOnlineProviders,
  needsNewOffer, nextOffer, rankByRoad, rankProviders,
} from '../src/services/matching';
import { FakeFirestore, FakeGeoPoint } from './fakeFirestore';

const driver: Coordinates = { latitude: 25.31, longitude: 51.44 }; // CMU-Q
const near: MatchProvider = { id: 'prov-near', name: 'Near', services: ['battery'], origin: { latitude: 25.32, longitude: 51.45 }, isOnline: true };
const far: MatchProvider = { id: 'prov-far', name: 'Far', services: [], origin: { latitude: 25.2, longitude: 51.55 }, isOnline: true };
const tyresOnly: MatchProvider = { id: 'prov-tyre', name: 'Tyres', services: ['tire'], origin: { latitude: 25.311, longitude: 51.441 }, isOnline: true };
const offline: MatchProvider = { ...near, id: 'prov-off', isOnline: false };

const T0 = '2026-11-19T10:00:00.000Z';

/** An order waiting for a technician. */
function waiting(patch: Partial<Order> = {}): Order {
  return {
    id: 'SND-1043-K7QF', serviceId: 'battery', optionId: 'jump', title: 'Battery Jump Start', carId: 'c', carLabel: 'Car',
    address: { id: 'a', label: 'CMU-Q', line: 'Education City', coords: driver, isDefault: false },
    schedule: { kind: 'asap' }, quote: buildQuote({ serviceId: 'battery', optionId: 'jump' }), payment: 'cash',
    status: 'confirmed', createdAt: T0, provider: { name: 'Waiting for a technician', rating: 0, vehicle: '', phone: '' },
    dispatch: 'provider', offeredTo: 'prov-near', offeredAt: T0, ...patch,
  };
}

/** A fake OSRM: road km per provider id (looked up by the start point). */
function fakeRoute(kmByStart: Map<string, number | 'fail'>) {
  return async (from: Coordinates): Promise<Route> => {
    const km = kmByStart.get(`${from.latitude},${from.longitude}`);
    if (km === undefined || km === 'fail') throw new Error('no route');
    return { distanceKm: km, durationMin: km * 2, path: [] };
  };
}
const key = (p: MatchProvider) => `${p.origin.latitude},${p.origin.longitude}`;

describe('who can take the job (V2 feature 8)', () => {
  it('keeps online technicians who offer the service (an empty list means every service), not the driver', () => {
    expect(eligibleProviders([near, far, tyresOnly, offline], 'battery').map((p) => p.id)).toEqual(['prov-near', 'prov-far']);
    expect(eligibleProviders([near, far], 'battery', 'prov-near').map((p) => p.id)).toEqual(['prov-far']);
  });
  it('sends to technicians only when one is available, so a demo never waits forever', () => {
    expect(dispatchFor(0)).toBe('simulated');
    expect(dispatchFor(2)).toBe('provider');
    expect(dispatchFor(0, true)).toBe('provider'); // Provider Mode test on one phone
  });
  it('reads a provider document, preferring the live location over the base', () => {
    expect(decodeMatchProvider('p1', { name: 'A', services: ['tire'], isOnline: true, base: new FakeGeoPoint(25.2, 51.5), lastLocation: new FakeGeoPoint(25.3, 51.4) }))
      .toEqual({ id: 'p1', name: 'A', services: ['tire'], isOnline: true, origin: { latitude: 25.3, longitude: 51.4 } });
    expect(decodeMatchProvider('p2', { name: 'B', isOnline: true, base: new FakeGeoPoint(25.2, 51.5), lastLocation: null })?.origin).toEqual({ latitude: 25.2, longitude: 51.5 });
    expect(decodeMatchProvider('p3', { name: 'C', isOnline: true })).toBeNull();
  });
});

describe('ranking by distance', () => {
  it('uses the straight line when no road distance is known', () => {
    expect(rankProviders([far, near], driver).map((r) => r.provider.id)).toEqual(['prov-near', 'prov-far']);
  });
  it('lets the road distance change the order', async () => {
    // The nearer one in a straight line has a long drive around (e.g. a highway with no exit).
    const ranked = await rankByRoad([near, far], driver, fakeRoute(new Map([[key(near), 30], [key(far), 12]])));
    expect(ranked.map((r) => [r.provider.id, r.km, r.byRoad])).toEqual([['prov-far', 12, true], ['prov-near', 30, true]]);
  });
  it('falls back to the straight line for a technician whose route fails', async () => {
    const ranked = await rankByRoad([near, far], driver, fakeRoute(new Map<string, number | 'fail'>([[key(near), 'fail'], [key(far), 20]])));
    expect(ranked[0]).toMatchObject({ provider: { id: 'prov-near' }, byRoad: false });
    expect(ranked[0].km).toBeLessThan(3);
  });
  it('does not wait forever for a slow route', async () => {
    const slow = () => new Promise<Route>(() => undefined);
    const ranked = await rankByRoad([near], driver, slow, 20);
    expect(ranked[0].byRoad).toBe(false);
  });
});

describe('moving the job on', () => {
  const online = new Set(['prov-near', 'prov-far']);
  it('waits while the technician is online and inside the 2 minutes', () => {
    expect(needsNewOffer(waiting(), online, Date.parse(T0) + OFFER_TIMEOUT_MS - 1000)).toBe(false);
  });
  it('moves on after 2 minutes, or as soon as the technician goes offline', () => {
    expect(needsNewOffer(waiting(), online, Date.parse(T0) + OFFER_TIMEOUT_MS)).toBe(true);
    expect(needsNewOffer(waiting(), new Set(['prov-far']), Date.parse(T0) + 1000)).toBe(true);
    expect(needsNewOffer(waiting({ offeredTo: undefined }), online)).toBe(true);
  });
  it('leaves accepted and simulated orders alone', () => {
    expect(isWaitingForProvider(waiting({ status: 'accepted' }))).toBe(false);
    expect(isWaitingForProvider(waiting({ dispatch: 'simulated' }))).toBe(false);
    expect(isWaitingForProvider(waiting({ provider: { id: 'prov-near', name: 'Near', rating: 5, vehicle: '', phone: '' } }))).toBe(false);
  });
  it('offers it to the next nearest technician, remembering who had it', () => {
    const ranked = rankProviders([near, far], driver);
    expect(nextOffer(waiting(), ranked, '2026-11-19T10:02:00.000Z'))
      .toEqual({ offeredTo: 'prov-far', offeredAt: '2026-11-19T10:02:00.000Z', offeredBefore: ['prov-near'] });
  });
  it('starts again from the nearest once everyone had it, and stays put with nobody else online', () => {
    const ranked = rankProviders([near, far], driver);
    expect(nextOffer(waiting({ offeredTo: 'prov-far', offeredBefore: ['prov-near'] }), ranked, T0))
      .toEqual({ offeredTo: 'prov-near', offeredAt: T0, offeredBefore: ['prov-far'] });
    expect(nextOffer(waiting(), rankProviders([near], driver), T0)).toBeNull();
  });
  it('gives a first offer to the nearest', () => {
    expect(nextOffer({}, rankProviders([far, near], driver), T0)).toEqual({ offeredTo: 'prov-near', offeredAt: T0, offeredBefore: [] });
  });
});

describe('online technicians from Firestore', () => {
  it('lists only online technicians, live', () => {
    const db = new FakeFirestore();
    const seen: string[][] = [];
    const stop = listenOnlineProviders(db, (p) => seen.push(p.map((x) => x.id)), () => undefined);
    db.externalSet('providers/a', { name: 'A', isOnline: true, services: [], base: new FakeGeoPoint(25.2, 51.5) });
    db.externalSet('providers/b', { name: 'B', isOnline: false, services: [], base: new FakeGeoPoint(25.2, 51.5) });
    expect(seen[seen.length - 1]).toEqual(['a']);
    db.externalSet('providers/a', { name: 'A', isOnline: false, services: [], base: new FakeGeoPoint(25.2, 51.5) });
    expect(seen[seen.length - 1]).toEqual([]);
    stop();
  });
});
