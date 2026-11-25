import { Address, Coordinates } from './types';

/**
 * Where the car really is, or undefined when it is not known. Orders made before typed locations were
 * looked up on the map (id 'described') carry the centre of Doha, which must not be used for distances.
 */
export function pinnedCoords(address: Address | undefined): Coordinates | undefined {
  return address && address.id !== 'described' ? address.coords : undefined;
}
