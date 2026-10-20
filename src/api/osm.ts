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

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const USER_AGENT = 'SANAD-prototype/0.3 (CMU-Q 67-443 student project)';
const TIMEOUT_MS = 12000;

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

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
    if ((e as Error).name === 'AbortError') throw new Error('Request timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** GET nearby places of one kind (Overpass). Widens the search once if nothing is found. */
export async function fetchNearbyPlaces(center: Coordinates, kind: PlaceKind, radiusM = 5000, limit = 10): Promise<Place[]> {
  for (const r of [radiusM, radiusM * 3]) {
    const body = `data=${encodeURIComponent(buildOverpassQuery(center, kind, r))}`;
    const json = await fetchJson(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const places = parseOverpass(json, center, kind, limit);
    if (places.length) return places;
  }
  return [];
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
