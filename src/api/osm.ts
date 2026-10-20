/**
 * External APIs (OpenStreetMap ecosystem, free and keyless):
 *  - Overpass API: finds real garages, fuel stations, car washes and tyre shops near the driver.
 *  - OSRM route service: driving distance, duration and route geometry between two points.
 *
 * Network calls are thin wrappers; the JSON parsing lives in pure functions so it can be unit tested.
 * Both public servers are for light, non-commercial use; a production app would self-host
 * OSRM/Overpass or switch to a paid provider (see docs/data-mapping.md).
 */
import { Platform } from 'react-native';
import { distanceKm } from '../models/pricing';
import { Coordinates, ServiceId } from '../models/types';

/**
 * Public Overpass servers. The main one is often overloaded (it timed out on the device test),
 * so the same query is sent to several mirrors at once and the first good answer wins.
 */
export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
export const OVERPASS_URL = OVERPASS_MIRRORS[0];

/** Nominatim (OpenStreetMap search) is a second, independent source of the same business data. */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_TERMS: Record<PlaceKind, string> = {
  garage: 'car repair',
  tyres: 'tyres',
  fuel: 'fuel',
  carwash: 'car wash',
};
export const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const USER_AGENT = 'SANAD-prototype/0.3 (CMU-Q 67-443 student project)';
const TIMEOUT_MS = 12000; // OSRM
const OVERPASS_TIMEOUT_MS = 20000;

export type PlaceKind = 'garage' | 'fuel' | 'carwash' | 'tyres';

/** A real business returned by Overpass, mapped to SANAD's provider model. */
export interface Place {
  id: string; // e.g. "node/123456"
  name: string;
  kind: PlaceKind;
  coords: Coordinates;
  distanceKm: number; // straight-line distance from the search centre
  phone?: string;
  openingHours?: string;
  source?: 'overpass' | 'nominatim';
}

export interface Route {
  distanceKm: number;
  durationMin: number;
  path: Coordinates[];
}

/** Which kind of business can fulfil each SANAD service. */
export const SERVICE_PLACE_KIND: Record<ServiceId, PlaceKind> = {
  battery: 'garage',
  oil: 'garage',
  emergency: 'garage',
  tire: 'tyres',
  fuel: 'fuel',
  carwash: 'carwash',
};

const KIND_FILTERS: Record<PlaceKind, string[]> = {
  garage: ['["shop"="car_repair"]'],
  tyres: ['["shop"="tyres"]', '["shop"="car_repair"]'],
  fuel: ['["amenity"="fuel"]'],
  carwash: ['["amenity"="car_wash"]'],
};

const DEFAULT_NAMES: Record<PlaceKind, string> = {
  garage: 'Garage',
  tyres: 'Tyre shop',
  fuel: 'Fuel station',
  carwash: 'Car wash',
};

/** Builds the Overpass QL query for one kind of place around a point. */
export function buildOverpassQuery(center: Coordinates, kind: PlaceKind, radiusM: number): string {
  const { latitude: lat, longitude: lon } = center;
  const parts = KIND_FILTERS[kind]
    .flatMap((f) => [`node${f}(around:${radiusM},${lat},${lon});`, `way${f}(around:${radiusM},${lat},${lon});`])
    .join('');
  return `[out:json][timeout:20];(${parts});out center;`;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Parses an Overpass JSON response into Places: named businesses first, each group nearest first. */
export function parseOverpass(json: unknown, center: Coordinates, kind: PlaceKind, limit = 10): Place[] {
  const elements = (json as { elements?: OverpassElement[] })?.elements;
  if (!Array.isArray(elements)) throw new Error('Unexpected Overpass response: no "elements" array');
  const seen = new Set<string>();
  const places: (Place & { named: boolean })[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const tags = el.tags ?? {};
    const coords = { latitude: lat, longitude: lon };
    const realName = tags['name:en'] || tags.name || tags.brand || tags.operator;
    places.push({
      id,
      named: !!realName,
      name: realName || DEFAULT_NAMES[kind],
      kind,
      coords,
      distanceKm: Math.round(distanceKm(center, coords) * 100) / 100,
      phone: tags.phone || tags['contact:phone'],
      openingHours: tags.opening_hours,
      source: 'overpass',
    });
  }
  // Named businesses first (a customer can recognise them), then by distance.
  return places
    .sort((a, b) => Number(b.named) - Number(a.named) || a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(({ named, ...p }) => p);
}

/** Parses an OSRM /route response (geometries=geojson) into distance, duration and path. */
export function parseOsrmRoute(json: unknown): Route {
  const data = json as {
    code?: string;
    message?: string;
    routes?: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }[];
  };
  if (data?.code !== 'Ok' || !data.routes?.length) throw new Error(`OSRM: ${data?.message ?? data?.code ?? 'no route'}`);
  const r = data.routes[0];
  const coords = r.geometry?.coordinates ?? [];
  return {
    distanceKm: Math.round((r.distance / 1000) * 100) / 100,
    durationMin: Math.max(1, Math.round(r.duration / 60)),
    // GeoJSON order is [longitude, latitude]
    path: coords.map(([lon, lat]) => ({ latitude: lat, longitude: lon })),
  };
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = TIMEOUT_MS, cancel?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  cancel?.addEventListener('abort', () => controller.abort());
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Browsers block a custom User-Agent (and it would trigger CORS preflight), so only send it from the app.
        ...(Platform.OS === 'web' ? {} : { 'User-Agent': USER_AGENT }),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if ((e as Error).name === 'AbortError' || /cancel|abort/i.test(msg)) throw new Error('timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Sends one Overpass query to every mirror at once; resolves with the first valid JSON and cancels the rest. */
export function queryOverpass(query: string, fetcher: typeof fetchJson = fetchJson): Promise<unknown> {
  const cancel = new AbortController();
  return new Promise((resolve, reject) => {
    let failed = 0;
    const errors: string[] = [];
    OVERPASS_MIRRORS.forEach((url) => {
      // GET with ?data= is the most widely supported way to call Overpass.
      fetcher(`${url}?data=${encodeURIComponent(query)}`, undefined, OVERPASS_TIMEOUT_MS, cancel.signal)
        .then((json) => {
          if (!Array.isArray((json as { elements?: unknown })?.elements)) throw new Error('bad response');
          cancel.abort();
          resolve(json);
        })
        .catch((e) => {
          errors.push(`${hostOf(url)}: ${(e as Error).message}`);
          failed += 1;
          if (failed === OVERPASS_MIRRORS.length) {
            const allTimedOut = errors.every((m) => m.endsWith('timed out'));
            reject(new Error(allTimedOut ? 'map servers timed out' : `map servers unavailable (${errors.join('; ')})`));
          }
        });
    });
  });
}

const hostOf = (url: string) => url.replace(/^https?:\/\//, '').split('/')[0];

/** Builds the Nominatim search URL for one kind of place inside a box around the driver. */
export function buildNominatimUrl(center: Coordinates, kind: PlaceKind, radiusKm: number, limit: number): string {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((center.latitude * Math.PI) / 180));
  const viewbox = [center.longitude - dLon, center.latitude + dLat, center.longitude + dLon, center.latitude - dLat].map((n) => n.toFixed(5)).join(',');
  const q = encodeURIComponent(NOMINATIM_TERMS[kind]);
  return `${NOMINATIM_URL}?format=jsonv2&q=${q}&viewbox=${viewbox}&bounded=1&countrycodes=qa&limit=${limit}&extratags=1`;
}

interface NominatimResult {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  extratags?: Record<string, string> | null;
}

/** Parses a Nominatim jsonv2 search response into Places (same rules as Overpass). */
export function parseNominatim(json: unknown, center: Coordinates, kind: PlaceKind, limit = 10): Place[] {
  if (!Array.isArray(json)) throw new Error('Unexpected Nominatim response: not an array');
  const seen = new Set<string>();
  const places: (Place & { named: boolean })[] = [];
  for (const r of json as NominatimResult[]) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const id = `${r.osm_type ?? 'node'}/${r.osm_id ?? `${lat},${lon}`}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const realName = r.name || undefined;
    const coords = { latitude: lat, longitude: lon };
    places.push({
      id,
      named: !!realName,
      name: realName || r.display_name?.split(',')[0] || DEFAULT_NAMES[kind],
      kind,
      coords,
      distanceKm: Math.round(distanceKm(center, coords) * 100) / 100,
      phone: r.extratags?.phone || r.extratags?.['contact:phone'],
      openingHours: r.extratags?.opening_hours,
      source: 'nominatim',
    });
  }
  return places
    .sort((a, b) => Number(b.named) - Number(a.named) || a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(({ named, ...p }) => p);
}

/** GET places from Nominatim (one request, no widening). */
export async function fetchNominatimPlaces(center: Coordinates, kind: PlaceKind, radiusKm: number, limit = 10): Promise<Place[]> {
  return parseNominatim(await fetchJson(buildNominatimUrl(center, kind, radiusKm, limit)), center, kind, limit);
}

/** GET places from Overpass only (all mirrors raced). */
export async function fetchOverpassPlaces(center: Coordinates, kind: PlaceKind, radiusM: number, limit = 10): Promise<Place[]> {
  return parseOverpass(await queryOverpass(buildOverpassQuery(center, kind, radiusM)), center, kind, limit);
}

/** Resolves with the first task that succeeds; rejects with every error if all fail. */
function firstSuccess<T>(tasks: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let failed = 0;
    const errors: string[] = [];
    tasks.forEach((t) =>
      t.then(resolve, (e) => {
        errors.push((e as Error).message);
        if (++failed === tasks.length) reject(new Error(errors.join(' | ')));
      }),
    );
  });
}

// Results are cached per area and kind, so screens that ask twice (e.g. provider + tow garages) share one request.
const placeCache = new Map<string, Promise<Place[]>>();

/** Nearby places of one kind from OpenStreetMap (Overpass or Nominatim). Widens the search once if nothing is found. */
export function fetchNearbyPlaces(center: Coordinates, kind: PlaceKind, radiusM = 5000, limit = 10): Promise<Place[]> {
  const key = `${kind}:${center.latitude.toFixed(3)},${center.longitude.toFixed(3)}:${radiusM}:${limit}`;
  const cached = placeCache.get(key);
  if (cached) return cached;
  // Ask Overpass (all mirrors) and Nominatim at the same time; use whichever returns places first.
  const overpass = (async () => {
    for (const r of [radiusM, radiusM * 3]) {
      const places = parseOverpass(await queryOverpass(buildOverpassQuery(center, kind, r)), center, kind, limit);
      if (places.length) return places.map((p) => ({ ...p, source: 'overpass' as const }));
    }
    throw new Error('Overpass: no places found');
  })().catch((e) => {
    throw new Error(`Overpass: ${(e as Error).message.replace(/^Overpass: /, '')}`);
  });
  const nominatim = (async () => {
    for (const km of [radiusM / 1000, (radiusM * 3) / 1000]) {
      const places = await fetchNominatimPlaces(center, kind, km, limit);
      if (places.length) return places;
    }
    throw new Error('no places found');
  })().catch((e) => {
    throw new Error(`Nominatim: ${(e as Error).message}`);
  });
  const request = firstSuccess([overpass, nominatim]);
  placeCache.set(key, request);
  request.catch(() => placeCache.delete(key)); // let a retry try again
  return request;
}

/** GET a driving route between two points (OSRM). */
export async function fetchRoute(from: Coordinates, to: Coordinates): Promise<Route> {
  const url = `${OSRM_URL}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
  return parseOsrmRoute(await fetchJson(url));
}

/** Point along a path at fraction t (0..1) of its length; used to animate the provider. */
export function pointAlongPath(path: Coordinates[], t: number): Coordinates {
  if (path.length === 0) throw new Error('Empty path');
  if (path.length === 1 || t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = distanceKm(path[i - 1], path[i]);
    seg.push(d);
    total += d;
  }
  let target = total * t;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const k = seg[i] === 0 ? 0 : Math.min(1, target / seg[i]);
      const a = path[i];
      const b = path[i + 1];
      return { latitude: a.latitude + (b.latitude - a.latitude) * k, longitude: a.longitude + (b.longitude - a.longitude) * k };
    }
    target -= seg[i];
  }
  return path[path.length - 1];
}
