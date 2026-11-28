/**
 * Nearest available provider matching (V2 feature 8).
 *
 * When a driver places an order and at least one technician who offers that service is online, the
 * order is sent to technicians (dispatch: 'provider') and offered to the nearest one only
 * (offeredTo). Nearest means the shortest road distance from where the technician is (their live
 * location, or their base) to the driver, using OSRM, with the straight-line distance when the route
 * cannot be fetched. If nobody is online the order stays 'simulated', so a demo never waits forever.
 *
 * If the technician does not accept within 2 minutes, or goes offline, the driver's phone offers the
 * job to the next nearest one (the rules let the driver change offeredTo while providerId is null).
 */
import { Route, fetchRoute } from '../api/osm';
import { COLLECTIONS } from '../models/firestore';
import { distanceKm } from '../models/pricing';
import { Coordinates, Order, ServiceId } from '../models/types';
import { FirestoreApi, toCoords } from './firestoreRepo';
import type { DriverOrderUpdate } from './ordersRepo';

/** How long a technician has to accept before the job moves to the next nearest one. */
export const OFFER_TIMEOUT_MS = 2 * 60 * 1000;
/** How long to wait for a road route before using the straight-line distance. */
export const ROUTE_TIMEOUT_MS = 4000;

/** What matching needs to know about an online technician. */
export interface MatchProvider {
  id: string;
  name: string;
  services: ServiceId[]; // empty means every service (see scripts/add-provider.ts)
  origin: Coordinates; // live location when shared, otherwise their base
  isOnline: boolean;
}

/** A technician with their distance to the driver. */
export interface RankedProvider {
  provider: MatchProvider;
  km: number;
  byRoad: boolean;
}

/** Reads providers/{uid} into what matching needs. Null when it has no usable location. */
export function decodeMatchProvider(id: string, data: Record<string, unknown>): MatchProvider | null {
  const loc = data.lastLocation ?? data.base;
  if (!loc) return null;
  const origin = toCoords(loc);
  if (!origin.latitude && !origin.longitude) return null;
  return {
    id,
    name: String(data.name ?? 'Technician'),
    services: Array.isArray(data.services) ? (data.services as ServiceId[]) : [],
    origin,
    isOnline: data.isOnline === true,
  };
}

/** Online technicians who offer this service, leaving out the driver themselves. */
export function eligibleProviders(providers: MatchProvider[], serviceId: ServiceId, driverId?: string | null): MatchProvider[] {
  return providers.filter((p) => p.isOnline && p.id !== driverId && (p.services.length === 0 || p.services.includes(serviceId)));
}

/** Send the order to technicians only when one can take it; otherwise the prototype technician does it. */
export function dispatchFor(eligibleCount: number, providerTestMode = false): 'provider' | 'simulated' {
  return providerTestMode || eligibleCount > 0 ? 'provider' : 'simulated';
}

/**
 * Orders technicians by distance to the driver: road km when known (from `roadKm`), straight line
 * otherwise. Ties go to the lower id so the order is always the same.
 */
export function rankProviders(providers: MatchProvider[], dest: Coordinates, roadKm: Record<string, number | undefined> = {}): RankedProvider[] {
  return providers
    .map((p) => {
      const road = roadKm[p.id];
      return road !== undefined ? { provider: p, km: road, byRoad: true } : { provider: p, km: distanceKm(p.origin, dest), byRoad: false };
    })
    .sort((a, b) => a.km - b.km || a.provider.id.localeCompare(b.provider.id));
}

/** Resolves to undefined if the promise takes longer than `ms`. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(undefined); });
  });
}

/** Road distance from each technician to the driver (OSRM). Technicians whose route fails are left out. */
export async function roadDistances(
  providers: MatchProvider[],
  dest: Coordinates,
  route: (from: Coordinates, to: Coordinates) => Promise<Route> = fetchRoute,
  timeoutMs = ROUTE_TIMEOUT_MS,
): Promise<Record<string, number>> {
  const results = await Promise.all(providers.map((p) => within(route(p.origin, dest), timeoutMs)));
  const out: Record<string, number> = {};
  results.forEach((r, i) => {
    if (r && Number.isFinite(r.distanceKm)) out[providers[i].id] = r.distanceKm;
  });
  return out;
}

/** Ranks technicians by road distance, falling back to the straight line for any route that fails. */
export async function rankByRoad(
  providers: MatchProvider[],
  dest: Coordinates,
  route?: (from: Coordinates, to: Coordinates) => Promise<Route>,
  timeoutMs?: number,
): Promise<RankedProvider[]> {
  if (providers.length === 0) return [];
  return rankProviders(providers, dest, await roadDistances(providers, dest, route, timeoutMs));
}

/** True when an order waits for a technician (sent to providers, nobody accepted yet). */
export function isWaitingForProvider(order: Order): boolean {
  return order.dispatch === 'provider' && order.status === 'confirmed' && !order.provider.id;
}

/** True when the waiting order should be offered to someone else: nobody, offline, or 2 minutes passed. */
export function needsNewOffer(order: Order, onlineIds: Set<string>, now = Date.now()): boolean {
  if (!isWaitingForProvider(order)) return false;
  if (!order.offeredTo || !onlineIds.has(order.offeredTo)) return true;
  return !order.offeredAt || now - Date.parse(order.offeredAt) >= OFFER_TIMEOUT_MS;
}

/**
 * Who the job goes to next, as the fields to write on the order, or null to leave it as it is.
 * Picks the nearest technician it was not offered to yet. When everyone has had it, it starts again
 * from the nearest one other than the current technician. With nobody else online, it stays put.
 */
export function nextOffer(order: Pick<Order, 'offeredTo' | 'offeredBefore'>, ranked: RankedProvider[], now = new Date().toISOString()): DriverOrderUpdate | null {
  const current = order.offeredTo;
  const tried = [...(order.offeredBefore ?? []), ...(current ? [current] : [])];
  const fresh = ranked.find((r) => !tried.includes(r.provider.id));
  if (fresh) return { offeredTo: fresh.provider.id, offeredAt: now, offeredBefore: tried };
  const again = ranked.find((r) => r.provider.id !== current);
  if (again) return { offeredTo: again.provider.id, offeredAt: now, offeredBefore: current ? [current] : [] };
  return null;
}

/** Reads the online technicians, live (providers where isOnline is true). */
export function listenOnlineProviders(api: FirestoreApi, next: (providers: MatchProvider[]) => void, error: (e: Error) => void): () => void {
  return api.onQuery(
    COLLECTIONS.providers,
    [['isOnline', '==', true]],
    (docs) => next(docs.map((d) => decodeMatchProvider(d.id, d.data)).filter((p): p is MatchProvider => p !== null)),
    error,
  );
}
