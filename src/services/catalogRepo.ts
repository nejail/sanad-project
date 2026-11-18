/**
 * Service catalogue from Cloud Firestore (services/{serviceId}).
 *
 * Prices and options can be changed in the Firebase console without an app update: the app reads
 * the `services` collection once per launch, after sign-in (the rules only let signed-in users read
 * it). If Firestore is not available (Expo Go, web, tests), is too slow, or a document is not
 * usable, the built-in catalogue in src/models/catalog.ts is used instead, so Home and the service
 * screens always work.
 */
import { SERVICES, setActiveCatalog } from '../models/catalog';
import { COLLECTIONS, serviceFromDoc } from '../models/firestore';
import { ServiceDefinition, ServiceId } from '../models/types';
import { FirestoreApi } from './firestoreRepo';

export type CatalogSource = 'builtin' | 'firestore';

export interface CatalogResult {
  source: CatalogSource;
  services: ServiceDefinition[];
  /** Services switched off in the console (active: false); hidden from Home. */
  hiddenIds: ServiceId[];
  /** How many documents were read from Firestore and used. */
  fromFirestore: number;
  /** Why the built-in catalogue was used, if it was. */
  reason?: string;
}

/** Rejects after `ms` so a slow network never holds up the app. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Merges Firestore documents over the built-in catalogue. A usable document replaces the
 * built-in service with the same id; services with no document (or a bad one) keep the built-in
 * definition. The order of SERVICES is kept.
 */
export function mergeCatalog(docs: { id: string; data: unknown }[]): Omit<CatalogResult, 'source' | 'reason'> {
  const byId = new Map(docs.map((d) => [d.id, d.data]));
  const hiddenIds: ServiceId[] = [];
  let fromFirestore = 0;
  const services = SERVICES.map((builtIn) => {
    if (!byId.has(builtIn.id)) return builtIn;
    const remote = serviceFromDoc(builtIn.id, byId.get(builtIn.id), builtIn);
    if (!remote) return builtIn;
    fromFirestore += 1;
    const { active, ...service } = remote;
    if (!active) hiddenIds.push(builtIn.id);
    return service;
  });
  return { services, hiddenIds, fromFirestore };
}

/**
 * Loads the catalogue from Firestore and makes it the active one.
 * `api` is null when Firestore is not available, which keeps the built-in catalogue.
 */
export async function loadCatalog(api: FirestoreApi | null, timeoutMs = 4000): Promise<CatalogResult> {
  const builtin = (reason: string): CatalogResult => {
    setActiveCatalog(SERVICES);
    return { source: 'builtin', services: SERVICES, hiddenIds: [], fromFirestore: 0, reason };
  };
  if (!api) return builtin('Firestore is not available here (Expo Go or web)');
  try {
    const docs = await withTimeout(api.getDocs(COLLECTIONS.services), timeoutMs);
    const merged = mergeCatalog(docs);
    if (merged.fromFirestore === 0) return builtin(docs.length ? 'No usable documents in services' : 'The services collection is empty');
    setActiveCatalog(merged.services, merged.hiddenIds);
    return { source: 'firestore', ...merged };
  } catch (e) {
    return builtin((e as Error).message || 'Could not read services');
  }
}
