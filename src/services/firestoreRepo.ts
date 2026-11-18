/**
 * Cloud Firestore repository for a customer's account: the profile, cars and addresses.
 *
 *   users/{uid}                          UserDoc
 *   users/{uid}/cars/{carId}             CarDoc
 *   users/{uid}/addresses/{addressId}    AddressDoc
 *
 * The documents are built with the converters in src/models/firestore.ts. On the way in and out
 * this file swaps the plain stand-ins for real Firestore types: coordinates become a GeoPoint and
 * dates become a Timestamp, so the console shows them properly and they can be queried later.
 *
 * Orders stay on the phone (AsyncStorage) this sprint and move to Firestore in Sprint 5.
 *
 * React Native Firebase is native code, so the SDK is only loaded inside the development build.
 * Everything here talks to a small FirestoreApi interface, which keeps the logic testable with an
 * in-memory fake (see __tests__/firestoreRepo.test.ts).
 */
import {
  AddressDoc, CarDoc, COLLECTIONS, GeoPointLike, UserDoc,
  addressFromDoc, addressToDoc, carFromDoc, carToDoc, userFromDoc, userToDoc,
} from '../models/firestore';
import { isFirstWashFree } from '../models/pricing';
import { Address, Car, Order, User } from '../models/types';

/** A document as plain data plus its id. */
export interface StoredDoc {
  id: string;
  data: Record<string, unknown>;
}

/** One write inside a batch. */
export type WriteOp =
  | { kind: 'set'; path: string; data: Record<string, unknown> }
  | { kind: 'delete'; path: string };

/** The part of the Firestore SDK that SANAD needs. The real one wraps React Native Firebase. */
export interface FirestoreApi {
  /** Reads one document; null when it does not exist. */
  getDoc(path: string): Promise<Record<string, unknown> | null>;
  /** Reads every document in a collection. */
  getDocs(collectionPath: string): Promise<StoredDoc[]>;
  /** Commits several writes together: all succeed or none do. */
  commit(ops: WriteOp[]): Promise<void>;
  /** Live updates for one document (null when it does not exist). Returns the unsubscribe function. */
  onDoc(path: string, next: (data: Record<string, unknown> | null) => void, error: (e: Error) => void): () => void;
  /** Live updates for a whole collection. Returns the unsubscribe function. */
  onCollection(collectionPath: string, next: (docs: StoredDoc[]) => void, error: (e: Error) => void): () => void;
  /** Makes a Firestore GeoPoint. */
  geoPoint(latitude: number, longitude: number): unknown;
  /** Makes a Firestore Timestamp from an ISO date string. */
  timestamp(iso: string): unknown;
}

/** The account data that lives in Firestore (orders are not included this sprint). */
export interface RemoteAccount {
  user: User;
  cars: Car[];
  addresses: Address[];
}

/** Account data as the app holds it (same shape as AccountData in storage.ts). */
export interface LocalAccount extends RemoteAccount {
  orders: Order[];
}

// ---------- converting to and from stored values ----------

/** Turns a Timestamp, a {seconds} object, a Date or an ISO string back into an ISO string. */
export function toIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  const v = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number } | null;
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v && typeof v.seconds === 'number') return new Date(v.seconds * 1000 + Math.round((v.nanoseconds ?? 0) / 1e6)).toISOString();
  return new Date(0).toISOString();
}

/** Copies a GeoPoint (or any {latitude, longitude}) into a plain object. */
export function toCoords(value: unknown): GeoPointLike {
  const v = (value ?? {}) as { latitude?: unknown; longitude?: unknown };
  return { latitude: Number(v.latitude) || 0, longitude: Number(v.longitude) || 0 };
}

/** UserDoc ready for Firestore: createdAt as a Timestamp. */
export function encodeUser(api: Pick<FirestoreApi, 'timestamp'>, doc: UserDoc): Record<string, unknown> {
  return { ...doc, createdAt: api.timestamp(doc.createdAt) };
}

/** CarDoc ready for Firestore: lastServiceAt as a Timestamp when set. */
export function encodeCar(api: Pick<FirestoreApi, 'timestamp'>, doc: CarDoc): Record<string, unknown> {
  return { ...doc, lastServiceAt: doc.lastServiceAt ? api.timestamp(doc.lastServiceAt) : null };
}

/** AddressDoc ready for Firestore: location as a GeoPoint. */
export function encodeAddress(api: Pick<FirestoreApi, 'geoPoint'>, doc: AddressDoc): Record<string, unknown> {
  return { ...doc, location: api.geoPoint(doc.location.latitude, doc.location.longitude) };
}

/** Reads users/{uid} back into the app's User. */
export function decodeUser(data: Record<string, unknown>): User {
  return userFromDoc({ ...(data as unknown as UserDoc), name: String(data.name ?? ''), phone: String(data.phone ?? ''), createdAt: toIso(data.createdAt) });
}

/** Reads users/{uid}/cars/{carId} back into the app's Car. */
export function decodeCar(id: string, data: Record<string, unknown>): Car {
  const d = data as unknown as CarDoc;
  return carFromDoc(id, {
    make: String(d.make ?? ''), model: String(d.model ?? ''), year: Number(d.year) || 0, plate: String(d.plate ?? ''),
    color: String(d.color ?? ''), fuel: String(d.fuel ?? ''), isDefault: d.isDefault === true,
    lastServiceAt: d.lastServiceAt ? toIso(d.lastServiceAt) : null,
  });
}

/** Reads users/{uid}/addresses/{addressId} back into the app's Address. */
export function decodeAddress(id: string, data: Record<string, unknown>): Address {
  const d = data as unknown as AddressDoc;
  return addressFromDoc(id, {
    label: String(d.label ?? ''), line: String(d.line ?? ''), landmark: d.landmark ? String(d.landmark) : null,
    location: toCoords(d.location), isDefault: d.isDefault === true,
  });
}

/** Keeps lists in a stable order (Firestore returns documents sorted by id). */
const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

// ---------- working out what changed ----------

/** The writes needed to bring Firestore from `prev` to `next`. Only changed documents are written. */
export interface AccountChanges {
  user: boolean;
  setCars: Car[];
  deleteCarIds: string[];
  setAddresses: Address[];
  deleteAddressIds: string[];
}

/** True when the change list has nothing to write. */
export function isEmptyChange(c: AccountChanges): boolean {
  return !c.user && !c.setCars.length && !c.deleteCarIds.length && !c.setAddresses.length && !c.deleteAddressIds.length;
}

/** Compares two versions of an account by what would be stored, so screen-only fields are ignored. */
export function diffAccount(prev: RemoteAccount | null, next: RemoteAccount): AccountChanges {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const prevCars = new Map((prev?.cars ?? []).map((c) => [c.id, carToDoc(c)]));
  const prevAddrs = new Map((prev?.addresses ?? []).map((a) => [a.id, addressToDoc(a)]));
  const nextCarIds = new Set(next.cars.map((c) => c.id));
  const nextAddrIds = new Set(next.addresses.map((a) => a.id));
  const userDoc = (acc: RemoteAccount | null) => (acc ? { ...userToDoc(acc.user, acc.cars, acc.addresses, false), firstWashUsed: undefined } : null);
  return {
    user: !same(userDoc(prev), userDoc(next)),
    setCars: next.cars.filter((c) => !same(prevCars.get(c.id), carToDoc(c))),
    deleteCarIds: [...prevCars.keys()].filter((id) => !nextCarIds.has(id)),
    setAddresses: next.addresses.filter((a) => !same(prevAddrs.get(a.id), addressToDoc(a))),
    deleteAddressIds: [...prevAddrs.keys()].filter((id) => !nextAddrIds.has(id)),
  };
}

/** True when two accounts would store exactly the same documents. */
export function sameRemote(a: RemoteAccount | null, b: RemoteAccount | null): boolean {
  if (!a || !b) return a === b;
  return isEmptyChange(diffAccount(a, b));
}

// ---------- the repository ----------

export class FirestoreRepo {
  constructor(private api: FirestoreApi) {}

  private userPath = (uid: string) => `${COLLECTIONS.users}/${uid}`;
  private carPath = (uid: string, carId: string) => `${COLLECTIONS.cars(uid)}/${carId}`;
  private addressPath = (uid: string, addressId: string) => `${COLLECTIONS.addresses(uid)}/${addressId}`;

  /** Builds the users/{uid} document. firstWashUsed comes from the orders on the phone. */
  private userData(account: RemoteAccount, orders: Order[] = []): Record<string, unknown> {
    return encodeUser(this.api, userToDoc(account.user, account.cars, account.addresses, !isFirstWashFree(orders)));
  }

  /** Loads users/{uid} with its cars and addresses. Null when this user has no profile yet. */
  async loadAccount(uid: string): Promise<RemoteAccount | null> {
    const userData = await this.api.getDoc(this.userPath(uid));
    if (!userData) return null;
    const [cars, addresses] = await Promise.all([
      this.api.getDocs(COLLECTIONS.cars(uid)),
      this.api.getDocs(COLLECTIONS.addresses(uid)),
    ]);
    return {
      user: decodeUser(userData),
      cars: cars.map((d) => decodeCar(d.id, d.data)).sort(byId),
      addresses: addresses.map((d) => decodeAddress(d.id, d.data)).sort(byId),
    };
  }

  /** Creates the profile, plus any cars and addresses the user already has (e.g. moved from the phone), in one batch. */
  async createUser(uid: string, user: User, cars: Car[] = [], addresses: Address[] = [], orders: Order[] = []): Promise<void> {
    const account = { user, cars, addresses };
    await this.api.commit([
      { kind: 'set', path: this.userPath(uid), data: this.userData(account, orders) },
      ...cars.map((c): WriteOp => ({ kind: 'set', path: this.carPath(uid, c.id), data: encodeCar(this.api, carToDoc(c)) })),
      ...addresses.map((a): WriteOp => ({ kind: 'set', path: this.addressPath(uid, a.id), data: encodeAddress(this.api, addressToDoc(a)) })),
    ]);
  }

  /** Writes one car. */
  async saveCar(uid: string, car: Car): Promise<void> {
    await this.api.commit([{ kind: 'set', path: this.carPath(uid, car.id), data: encodeCar(this.api, carToDoc(car)) }]);
  }

  /** Deletes one car. */
  async deleteCar(uid: string, carId: string): Promise<void> {
    await this.api.commit([{ kind: 'delete', path: this.carPath(uid, carId) }]);
  }

  /** Writes one address. */
  async saveAddress(uid: string, address: Address): Promise<void> {
    await this.api.commit([{ kind: 'set', path: this.addressPath(uid, address.id), data: encodeAddress(this.api, addressToDoc(address)) }]);
  }

  /** Deletes one address. */
  async deleteAddress(uid: string, addressId: string): Promise<void> {
    await this.api.commit([{ kind: 'delete', path: this.addressPath(uid, addressId) }]);
  }

  /**
   * Writes everything that changed between two versions of the account in one batch.
   * Adding a default car, for example, also clears isDefault on the old one and updates
   * defaultCarId on the profile; the batch keeps those writes together.
   * Returns the number of documents written.
   */
  async syncChanges(uid: string, prev: RemoteAccount | null, next: LocalAccount): Promise<number> {
    const c = diffAccount(prev, next);
    const ops: WriteOp[] = [
      ...(c.user ? [{ kind: 'set', path: this.userPath(uid), data: this.userData(next, next.orders) } as WriteOp] : []),
      ...c.setCars.map((car): WriteOp => ({ kind: 'set', path: this.carPath(uid, car.id), data: encodeCar(this.api, carToDoc(car)) })),
      ...c.deleteCarIds.map((id): WriteOp => ({ kind: 'delete', path: this.carPath(uid, id) })),
      ...c.setAddresses.map((a): WriteOp => ({ kind: 'set', path: this.addressPath(uid, a.id), data: encodeAddress(this.api, addressToDoc(a)) })),
      ...c.deleteAddressIds.map((id): WriteOp => ({ kind: 'delete', path: this.addressPath(uid, id) })),
    ];
    if (ops.length) await this.api.commit(ops);
    return ops.length;
  }

  /**
   * Live updates for the whole account. Calls `onChange` once the profile, cars and addresses
   * have all arrived, then again whenever any of them changes, including from another device.
   * Returns a function that stops listening.
   */
  listenAccount(uid: string, onChange: (account: RemoteAccount | null) => void, onError: (e: Error) => void = () => undefined): () => void {
    let user: User | null | undefined;
    let cars: Car[] | undefined;
    let addresses: Address[] | undefined;
    const emit = () => {
      if (user === undefined || cars === undefined || addresses === undefined) return; // wait for all three
      onChange(user ? { user, cars, addresses } : null);
    };
    const stops = [
      this.api.onDoc(this.userPath(uid), (d) => { user = d ? decodeUser(d) : null; emit(); }, onError),
      this.api.onCollection(COLLECTIONS.cars(uid), (docs) => { cars = docs.map((d) => decodeCar(d.id, d.data)).sort(byId); emit(); }, onError),
      this.api.onCollection(COLLECTIONS.addresses(uid), (docs) => { addresses = docs.map((d) => decodeAddress(d.id, d.data)).sort(byId); emit(); }, onError),
    ];
    return () => stops.forEach((stop) => stop());
  }
}

// ---------- React Native Firebase adapter ----------

/** Wraps the React Native Firebase modular API. Only called inside the development build. */
export function createFirestoreApi(): FirestoreApi {
  // Required lazily so Expo Go and the tests never load the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('@react-native-firebase/firestore');
  const db = fs.getFirestore();
  const asDocs = (snap: { docs: { id: string; data(): Record<string, unknown> }[] }): StoredDoc[] =>
    snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  return {
    async getDoc(path) {
      const snap = await fs.getDoc(fs.doc(db, path));
      return snap.exists() ? snap.data() : null;
    },
    async getDocs(path) {
      return asDocs(await fs.getDocs(fs.collection(db, path)));
    },
    async commit(ops) {
      const batch = fs.writeBatch(db);
      for (const op of ops) {
        if (op.kind === 'set') batch.set(fs.doc(db, op.path), op.data);
        else batch.delete(fs.doc(db, op.path));
      }
      await batch.commit();
    },
    onDoc(path, next, error) {
      return fs.onSnapshot(fs.doc(db, path), (snap: { exists(): boolean; data(): Record<string, unknown> }) => next(snap.exists() ? snap.data() : null), error);
    },
    onCollection(path, next, error) {
      return fs.onSnapshot(fs.collection(db, path), (snap: { docs: { id: string; data(): Record<string, unknown> }[] }) => next(asDocs(snap)), error);
    },
    geoPoint: (latitude, longitude) => new fs.GeoPoint(latitude, longitude),
    timestamp: (iso) => fs.Timestamp.fromDate(new Date(iso)),
  };
}

let api: FirestoreApi | null = null;

/** The Firestore API for this run of the app (created on first use). */
export function getFirestoreApi(): FirestoreApi {
  if (!api) api = createFirestoreApi();
  return api;
}

/** Test hook: replace the Firestore API. */
export function setFirestoreApiForTests(fake: FirestoreApi | null) {
  api = fake;
}

/** Turns Firestore error codes into a short message for the driver. */
export function firestoreMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'Your account could not be saved: permission denied. Sign out and sign in again.';
  if (code.includes('unavailable') || code.includes('deadline-exceeded')) return 'No connection to SANAD. Your change is saved on this phone and will sync when you are back online.';
  if (code.includes('unauthenticated')) return 'Your session has ended. Sign in again to save changes.';
  if (code.includes('resource-exhausted')) return 'SANAD is busy right now. Try again in a minute.';
  return 'Your change could not be saved to your account. Try again.';
}
