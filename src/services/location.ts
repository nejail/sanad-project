import * as Location from 'expo-location';
import { Coordinates } from '../models/types';

export const DOHA: Coordinates = { latitude: 25.2854, longitude: 51.531 };

export interface CurrentPlace {
  coords: Coordinates;
  accuracy: number | null;
  address: string;
  ms: number;
}

export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  const asked = await Location.requestForegroundPermissionsAsync();
  return asked.granted;
}

const coordText = (c: Coordinates) => `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`;

function formatAddress(a: Location.LocationGeocodedAddress | undefined, c: Coordinates): string {
  if (!a) return coordText(c);
  const parts = [a.name ?? a.street, a.district ?? a.subregion, a.city].filter(Boolean);
  return Array.from(new Set(parts)).join(', ') || coordText(c);
}

/** Current GPS position plus a readable address (reverse geocoded). */
export async function getCurrentPlace(): Promise<CurrentPlace> {
  const started = Date.now();
  if (!(await ensureLocationPermission())) throw new Error('Location permission was denied');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  let address = 'Current location';
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    address = formatAddress(results[0], coords);
  } catch {
    // Reverse geocoding is not available on every platform (e.g. web); keep coordinates.
    address = coordText(coords);
  }
  return { coords, accuracy: pos.coords.accuracy ?? null, address, ms: Date.now() - started };
}

export async function reverseGeocode(coords: Coordinates): Promise<string> {
  const results = await Location.reverseGeocodeAsync(coords);
  return formatAddress(results[0], coords);
}
