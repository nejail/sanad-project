import { Address, Coordinates } from './types';

/** Centre of Doha: where maps open before the driver's position is known. */
export const DOHA: Coordinates = { latitude: 25.2854, longitude: 51.531 };

/**
 * Where the car really is, or undefined when it is not known. Before typed places were looked up on
 * the map, a typed location (id 'described') or an address typed on Add Address was saved with the
 * centre of Doha, so those must not be used for distances, matching or the technician's map.
 */
export function pinnedCoords(address: Address | undefined): Coordinates | undefined {
  if (!address || address.id === 'described') return undefined;
  const c = address.coords;
  return c.latitude === DOHA.latitude && c.longitude === DOHA.longitude ? undefined : c;
}
