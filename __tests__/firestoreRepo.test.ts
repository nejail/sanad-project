import { DEMO_ADDRESSES, DEMO_CARS, DEMO_ORDERS, DEMO_USER } from '../src/models/seed';
import { Car } from '../src/models/types';
import {
  FirestoreRepo, decodeAddress, decodeCar, decodeUser, diffAccount, firestoreMessage, isEmptyChange, sameRemote, toCoords, toIso,
} from '../src/services/firestoreRepo';
import { FakeFirestore, FakeGeoPoint, FakeTimestamp } from './fakeFirestore';

const UID = 'uidHassan';
const OTHER = 'uidSomeoneElse';
// Firestore does not store the screen-only "last service" text.
const cars = DEMO_CARS.map(({ lastService, ...c }) => c as Car);
const account = { user: DEMO_USER, cars, addresses: DEMO_ADDRESSES };

describe('stored value conversion', () => {
  it('reads Timestamps, {seconds} objects, Dates and strings as ISO dates', () => {
    const iso = '2026-09-01T09:00:00.000Z';
    expect(toIso(new FakeTimestamp(new Date(iso)))).toBe(iso);
    expect(toIso({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 })).toBe(iso);
    expect(toIso(new Date(iso))).toBe(iso);
    expect(toIso(iso)).toBe(iso);
  });

  it('copies GeoPoints into plain coordinates', () => {
    expect(toCoords(new FakeGeoPoint(25.3155, 51.439))).toEqual({ latitude: 25.3155, longitude: 51.439 });
    expect(toCoords(undefined)).toEqual({ latitude: 0, longitude: 0 });
  });

  it('decodes documents with missing fields without crashing', () => {
    expect(decodeCar('c1', { make: 'Kia' })).toMatchObject({ id: 'c1', make: 'Kia', year: '0', isDefault: false });
    expect(decodeAddress('a1', { label: 'Home' }).coords).toEqual({ latitude: 0, longitude: 0 });
    expect(decodeUser({ phone: '+97450123456', name: 'Hassan' }).phone).toBe('50123456');
  });
});

describe('FirestoreRepo', () => {
  let db: FakeFirestore;
  let repo: FirestoreRepo;
  beforeEach(() => {
    db = new FakeFirestore();
    repo = new FirestoreRepo(db);
  });

  it('returns null for a user with no profile yet', async () => {
    expect(await repo.loadAccount(UID)).toBeNull();
  });

  it('creates the profile with cars and addresses in one batch, at the agreed paths', async () => {
    await repo.createUser(UID, DEMO_USER, cars, DEMO_ADDRESSES, DEMO_ORDERS);
    expect(db.commits).toHaveLength(1);
    expect([...db.docs.keys()].sort()).toEqual([
      `users/${UID}`,
      `users/${UID}/addresses/addr-1`, `users/${UID}/addresses/addr-2`, `users/${UID}/addresses/addr-3`,
      `users/${UID}/cars/car-1`, `users/${UID}/cars/car-2`,
    ]);
    const user = db.docs.get(`users/${UID}`)!;
    expect(user.phone).toBe('+97450123456');
    expect(user.createdAt).toBeInstanceOf(FakeTimestamp);
    expect(user.defaultCarId).toBe('car-1');
    expect(user.defaultAddressId).toBe('addr-1');
    expect(user.firstWashUsed).toBe(false);
    expect(db.docs.get(`users/${UID}/addresses/addr-2`)!.location).toBeInstanceOf(FakeGeoPoint);
    expect(db.docs.get(`users/${UID}/cars/car-1`)!.year).toBe(2023);
  });

  it('loads back exactly what was saved', async () => {
    await repo.createUser(UID, DEMO_USER, cars, DEMO_ADDRESSES);
    const loaded = await repo.loadAccount(UID);
    expect(loaded?.user).toEqual(DEMO_USER);
    expect(loaded?.cars).toEqual(cars);
    expect(loaded?.addresses).toEqual(DEMO_ADDRESSES.map((a) => ({ ...a, landmark: undefined })));
  });

  it('keeps each user in their own tree', async () => {
    await repo.createUser(UID, DEMO_USER, cars);
    await repo.createUser(OTHER, { ...DEMO_USER, phone: '66554433', name: 'Nasser' });
    expect((await repo.loadAccount(OTHER))?.cars).toEqual([]);
    expect((await repo.loadAccount(UID))?.cars).toHaveLength(2);
  });

  it('saves and deletes single cars and addresses', async () => {
    await repo.createUser(UID, DEMO_USER);
    await repo.saveCar(UID, cars[0]);
    await repo.saveAddress(UID, DEMO_ADDRESSES[1]);
    expect((await repo.loadAccount(UID))?.cars.map((c) => c.id)).toEqual(['car-1']);
    await repo.deleteCar(UID, 'car-1');
    await repo.deleteAddress(UID, 'addr-2');
    const loaded = await repo.loadAccount(UID);
    expect(loaded?.cars).toEqual([]);
    expect(loaded?.addresses).toEqual([]);
  });

  it('writes only what changed, in one batch', async () => {
    await repo.createUser(UID, DEMO_USER, cars, DEMO_ADDRESSES);
    db.commits = [];
    // New default car: the old default flips to false and the profile's defaultCarId changes.
    const newCar: Car = { id: 'car-3', make: 'Kia', model: 'Sportage', year: '2024', plate: 'QA-9999', color: 'Grey', fuel: 'Gasoline', isDefault: true };
    const next = { ...account, cars: [...cars.map((c) => ({ ...c, isDefault: false })), newCar], orders: [] };
    const written = await repo.syncChanges(UID, account, next);
    expect(db.commits).toHaveLength(1);
    expect(written).toBe(3); // profile, car-1 (no longer default), car-3 (new); car-2 unchanged
    expect(db.docs.get(`users/${UID}`)!.defaultCarId).toBe('car-3');
    expect(db.docs.get(`users/${UID}/cars/car-1`)!.isDefault).toBe(false);
  });

  it('writes nothing when nothing stored changed (a new order is not a profile change)', async () => {
    const written = await repo.syncChanges(UID, account, { ...account, orders: DEMO_ORDERS });
    expect(written).toBe(0);
    expect(db.commits).toHaveLength(0);
  });

  it('deletes removed cars when syncing', async () => {
    await repo.createUser(UID, DEMO_USER, cars, DEMO_ADDRESSES);
    await repo.syncChanges(UID, account, { ...account, cars: [cars[0]], orders: [] });
    expect(db.docs.has(`users/${UID}/cars/car-2`)).toBe(false);
  });

  it('passes write failures to the caller', async () => {
    db.failNext = 'permission-denied';
    await expect(repo.saveCar(UID, cars[0])).rejects.toMatchObject({ code: 'firestore/permission-denied' });
  });

  it('listens to the profile, cars and addresses together, including changes from another device', async () => {
    await repo.createUser(UID, DEMO_USER, cars, DEMO_ADDRESSES);
    const seen: (number | null)[] = [];
    const stop = repo.listenAccount(UID, (a) => seen.push(a ? a.cars.length : null));
    expect(seen).toEqual([2]); // one combined update once all three have arrived

    // Another phone adds a car.
    db.externalSet(`users/${UID}/cars/car-9`, { make: 'BMW', model: 'X5', year: 2022, plate: 'QA-1', color: 'Blue', fuel: 'Gasoline', isDefault: false, lastServiceAt: null });
    expect(seen[seen.length - 1]).toBe(3);

    stop();
    expect(db.listenerCount).toBe(0);
    db.externalSet(`users/${UID}/cars/car-10`, { make: 'Audi' });
    expect(seen[seen.length - 1]).toBe(3); // no updates after unsubscribing
  });

  it('reports a missing profile as null to the listener', () => {
    const seen: unknown[] = [];
    repo.listenAccount(UID, (a) => seen.push(a));
    expect(seen).toEqual([null]);
  });
});

describe('diffAccount', () => {
  it('treats a first save as writing everything', () => {
    const c = diffAccount(null, account);
    expect(c.user).toBe(true);
    expect(c.setCars).toHaveLength(2);
    expect(c.setAddresses).toHaveLength(3);
  });

  it('ignores screen-only fields such as "last service"', () => {
    const withLabel = { ...account, cars: DEMO_CARS };
    expect(isEmptyChange(diffAccount(account, withLabel))).toBe(true);
    expect(sameRemote(account, withLabel)).toBe(true);
  });

  it('notices a renamed user and a new address', () => {
    const next = {
      ...account,
      user: { ...DEMO_USER, name: 'Hassan Q' },
      addresses: [...DEMO_ADDRESSES, { id: 'addr-4', label: 'Gym', line: 'Aspire Zone', coords: { latitude: 25.26, longitude: 51.44 }, isDefault: false }],
    };
    const c = diffAccount(account, next);
    expect(c.user).toBe(true);
    expect(c.setAddresses.map((a) => a.id)).toEqual(['addr-4']);
    expect(c.deleteCarIds).toEqual([]);
  });
});

describe('firestoreMessage', () => {
  it('gives the driver a short reason', () => {
    expect(firestoreMessage({ code: 'firestore/permission-denied' })).toMatch(/permission denied/);
    expect(firestoreMessage({ code: 'firestore/unavailable' })).toMatch(/No connection/);
    expect(firestoreMessage(new Error('x'))).toMatch(/could not be saved/);
  });
});
