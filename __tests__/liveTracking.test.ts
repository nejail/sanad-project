import { LiveFix, STALE_AFTER_MS, encodeGeohash, isFresh, liveEtaMin, pathFrom, shouldPublish } from '../src/models/liveTracking';
import { TrackingRepo, decodeTracking, livePath } from '../src/services/trackingRepo';
import { FakeFirestore, FakeGeoPoint, FakeTimestamp } from './fakeFirestore';

const T0 = '2026-11-19T10:00:00.000Z';
const cmuq = { latitude: 25.3143, longitude: 51.4391 };

describe('live tracking helpers (V2 feature 7)', () => {
  it('encodes a geohash like the standard implementation', () => {
    expect(encodeGeohash({ latitude: 57.64911, longitude: 10.40744 }, 11)).toBe('u4pruydqqvj');
    expect(encodeGeohash(cmuq)).toHaveLength(7);
    expect(encodeGeohash(cmuq).startsWith('ths')).toBe(true); // Doha area
  });
  it('publishes at most every few seconds', () => {
    expect(shouldPublish(null, 1000)).toBe(true);
    expect(shouldPublish(1000, 3000)).toBe(false);
    expect(shouldPublish(1000, 5000)).toBe(true);
  });
  it('estimates the ETA from the live position', () => {
    expect(liveEtaMin(cmuq, cmuq)).toBe(4); // dispatch minimum when already there
    expect(liveEtaMin({ latitude: 25.2854, longitude: 51.531 }, cmuq)).toBeGreaterThan(10);
  });
  it('ignores positions that are too old', () => {
    const fix: LiveFix = { coords: cmuq, heading: null, etaMin: 5, updatedAt: T0 };
    expect(isFresh(fix, Date.parse(T0) + 10_000)).toBe(true);
    expect(isFresh(fix, Date.parse(T0) + STALE_AFTER_MS + 1)).toBe(false);
    expect(isFresh(null)).toBe(false);
  });
  it('cuts the road route at the point nearest the technician', () => {
    const path = [{ latitude: 25.30, longitude: 51.40 }, { latitude: 25.31, longitude: 51.42 }, { latitude: 25.314, longitude: 51.439 }];
    expect(pathFrom(path, { latitude: 25.3101, longitude: 51.4202 })).toEqual(path.slice(1));
    expect(pathFrom([], cmuq)).toEqual([]);
  });
});

describe('TrackingRepo', () => {
  it('writes the live position and the technician\'s last location together', async () => {
    const db = new FakeFirestore();
    db.externalSet('providers/prov-1', { name: 'Ahmed', isOnline: true, lastLocation: null, geohash: null });
    await new TrackingRepo(db).publish('SND-1', 'prov-1', cmuq, 6, 90, T0);
    expect(db.commits).toHaveLength(1);
    const live = db.docs.get(livePath('SND-1'))!;
    expect(live.location).toBeInstanceOf(FakeGeoPoint);
    expect(live.etaMin).toBe(6);
    expect(live.heading).toBe(90);
    expect(live.updatedAt).toBeInstanceOf(FakeTimestamp);
    const provider = db.docs.get('providers/prov-1')!;
    expect(provider.lastLocation).toBeInstanceOf(FakeGeoPoint);
    expect(provider.geohash).toBe(encodeGeohash(cmuq));
    expect(provider.name).toBe('Ahmed'); // only location fields change
  });

  it('lets the driver follow the van live, including a position written in the console', () => {
    const db = new FakeFirestore();
    const seen: (LiveFix | null)[] = [];
    const stop = new TrackingRepo(db).listen('SND-1', (f) => seen.push(f), () => undefined);
    expect(seen[0]).toBeNull();
    db.externalSet('orders/SND-1/tracking/live', { location: new FakeGeoPoint(25.3, 51.45), etaMin: 3, heading: null, updatedAt: new FakeTimestamp(new Date(T0)) });
    expect(seen[seen.length - 1]).toEqual({ coords: { latitude: 25.3, longitude: 51.45 }, heading: null, etaMin: 3, updatedAt: T0 });
    stop();
    expect(db.listenerCount).toBe(0);
  });

  it('reads a document with missing fields safely', () => {
    expect(decodeTracking(null)).toBeNull();
    expect(decodeTracking({ etaMin: 3 })).toBeNull();
    expect(decodeTracking({ location: { latitude: 25.3, longitude: 51.4 }, updatedAt: T0 })).toMatchObject({ etaMin: null, heading: null });
  });
});
