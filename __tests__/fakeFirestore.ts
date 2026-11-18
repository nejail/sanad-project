/**
 * In-memory stand-in for Cloud Firestore used by the repository tests (no network).
 * Supports reads, batched writes and live listeners on documents and collections.
 */
import { FirestoreApi, StoredDoc, WriteOp } from '../src/services/firestoreRepo';

/** Marker types so tests can check that GeoPoint and Timestamp were used. */
export class FakeGeoPoint {
  constructor(public latitude: number, public longitude: number) {}
}
export class FakeTimestamp {
  constructor(private date: Date) {}
  toDate() {
    return this.date;
  }
}

type DocListener = { path: string; next: (d: Record<string, unknown> | null) => void };
type ColListener = { path: string; next: (docs: StoredDoc[]) => void };

export class FakeFirestore implements FirestoreApi {
  docs = new Map<string, Record<string, unknown>>();
  commits: WriteOp[][] = [];
  /** Set to make the next commit fail with this Firestore error code. */
  failNext: string | null = null;
  /** Set to make reads fail with this Firestore error code. */
  failReads: string | null = null;
  private docListeners: DocListener[] = [];
  private colListeners: ColListener[] = [];

  /** Documents directly inside a collection (not in deeper subcollections). */
  list(collectionPath: string): StoredDoc[] {
    const prefix = `${collectionPath}/`;
    return [...this.docs.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map(([p, data]) => ({ id: p.slice(prefix.length), data }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private error(code: string) {
    return Object.assign(new Error(code), { code: `firestore/${code}` });
  }

  async getDoc(path: string) {
    if (this.failReads) throw this.error(this.failReads);
    return this.docs.get(path) ?? null;
  }

  async getDocs(collectionPath: string) {
    if (this.failReads) throw this.error(this.failReads);
    return this.list(collectionPath);
  }

  async commit(ops: WriteOp[]) {
    if (this.failNext) {
      const code = this.failNext;
      this.failNext = null;
      throw this.error(code);
    }
    this.commits.push(ops);
    for (const op of ops) {
      if (op.kind === 'set') this.docs.set(op.path, op.data);
      else this.docs.delete(op.path);
    }
    this.notify();
  }

  /** Simulates a write from another device (or the console). */
  externalSet(path: string, data: Record<string, unknown> | null) {
    if (data) this.docs.set(path, data);
    else this.docs.delete(path);
    this.notify();
  }

  private notify() {
    this.docListeners.forEach((l) => l.next(this.docs.get(l.path) ?? null));
    this.colListeners.forEach((l) => l.next(this.list(l.path)));
  }

  onDoc(path: string, next: (d: Record<string, unknown> | null) => void) {
    const l = { path, next };
    this.docListeners.push(l);
    next(this.docs.get(path) ?? null);
    return () => {
      this.docListeners = this.docListeners.filter((x) => x !== l);
    };
  }

  onCollection(path: string, next: (docs: StoredDoc[]) => void) {
    const l = { path, next };
    this.colListeners.push(l);
    next(this.list(path));
    return () => {
      this.colListeners = this.colListeners.filter((x) => x !== l);
    };
  }

  geoPoint(latitude: number, longitude: number) {
    return new FakeGeoPoint(latitude, longitude);
  }

  timestamp(iso: string) {
    return new FakeTimestamp(new Date(iso));
  }

  /** Number of active listeners (to check unsubscribe). */
  get listenerCount() {
    return this.docListeners.length + this.colListeners.length;
  }
}
