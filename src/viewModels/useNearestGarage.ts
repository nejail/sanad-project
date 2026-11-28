import { useMemo } from 'react';
import { nearestByRoad } from '../models/garages';
import { Coordinates } from '../models/types';
import { PlaceWithRoute, useNearbyPlaces } from './useNearbyPlaces';

/**
 * The garages closest to the driver, with the real driving distance to the three nearest,
 * and the one that is nearest by road. Used for towing on the Service and Review Order screens,
 * so the distance (and with it the tow price) is known from the first price screen.
 */
export function useNearestGarage(center: Coordinates | undefined, enabled: boolean) {
  const garages = useNearbyPlaces(center, 'garage', { limit: 3, withRoutes: 3, direction: 'fromCustomer', enabled });
  const nearest: PlaceWithRoute | undefined = useMemo(() => nearestByRoad(garages.places), [garages.places]);
  return { ...garages, nearest };
}
