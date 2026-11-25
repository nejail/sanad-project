/**
 * Live tracking from the technician's real location (V2 feature 7). Pure helpers shared by the
 * technician's phone (which publishes its position) and the driver's Track Order (which shows it).
 */
import { distanceKm, etaMinutes } from './pricing';
import { Coordinates } from './types';

/** The technician's latest position for an order, as the driver's phone reads it. */
export interface LiveFix {
  coords: Coordinates;
  heading: number | null;
  etaMin: number | null;
  updatedAt: string; // ISO date
}

/** Minimum time between two published positions, so Firestore gets a few writes a minute, not dozens. */
export const PUBLISH_EVERY_MS = 4000;
/** A position older than this is treated as lost (the technician's app closed or no signal). */
export const STALE_AFTER_MS = 2 * 60 * 1000;

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Geohash of a position (standard base-32 encoding). Stored on providers/{uid} next to lastLocation,
 * so "technicians near me" can later be one range query. 7 characters is about 150 m.
 */
export function encodeGeohash(c: Coordinates, precision = 7): string {
  const lat: [number, number] = [-90, 90];
  const lon: [number, number] = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    const range = even ? lon : lat;
    const value = even ? c.longitude : c.latitude;
    const mid = (range[0] + range[1]) / 2;
    if (value >= mid) {
      ch = (ch << 1) | 1;
      range[0] = mid;
    } else {
      ch <<= 1;
      range[1] = mid;
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/** True when enough time has passed since the last published position to send a new one. */
export function shouldPublish(lastAt: number | null, now: number, everyMs = PUBLISH_EVERY_MS): boolean {
  return lastAt === null || now - lastAt >= everyMs;
}

/** ETA in minutes from the technician's position to the driver (rough city driving speed). */
export function liveEtaMin(from: Coordinates, to: Coordinates): number {
  return etaMinutes(distanceKm(from, to));
}

/** True when the last position is recent enough to show. */
export function isFresh(fix: LiveFix | null, now = Date.now()): fix is LiveFix {
  return !!fix && now - Date.parse(fix.updatedAt) < STALE_AFTER_MS;
}

/** The rest of a road route from the point nearest to where the technician is now. */
export function pathFrom(path: Coordinates[], here: Coordinates): Coordinates[] {
  if (path.length === 0) return [];
  let best = 0;
  let bestKm = Infinity;
  path.forEach((p, i) => {
    const km = distanceKm(p, here);
    if (km < bestKm) {
      bestKm = km;
      best = i;
    }
  });
  return path.slice(best);
}

/**
 * The job whose location the technician's phone should share: their own job that is On the way.
 * Used by LiveLocationProvider, so sharing runs anywhere in the app, not only on the job screen.
 */
export function activeSharingJob<T extends { status: string; provider: { id?: string } }>(jobs: T[], uid: string | null | undefined): T | undefined {
  if (!uid) return undefined;
  return jobs.find((j) => j.status === 'on_the_way' && j.provider.id === uid);
}
