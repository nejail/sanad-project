import { useEffect, useState } from 'react';
import { Place, PlaceKind, Route, fetchNearbyPlaces, fetchRoute } from '../api/osm';
import { Coordinates } from '../models/types';

export interface PlaceWithRoute extends Place {
  route?: Route; // driving route between the place and the customer (OSRM)
}

interface State {
  loading: boolean;
  error?: string;
  places: PlaceWithRoute[];
}

/**
 * Loads real places near `center` from Overpass, then asks OSRM for the driving route
 * of the closest `withRoutes` results. `direction` sets which way the route goes:
 * 'toCustomer' (provider driving to the driver) or 'fromCustomer' (towing to a garage).
 */
export function useNearbyPlaces(
  center: Coordinates | undefined,
  kind: PlaceKind,
  options: { limit?: number; withRoutes?: number; direction?: 'toCustomer' | 'fromCustomer'; enabled?: boolean } = {},
): State & { retry: () => void } {
  const { limit = 5, withRoutes = 1, direction = 'toCustomer', enabled = true } = options;
  const [state, setState] = useState<State>({ loading: !!center && enabled, places: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!center || !enabled) return;
    let cancelled = false;
    setState({ loading: true, places: [] });
    (async () => {
      try {
        const places: PlaceWithRoute[] = await fetchNearbyPlaces(center, kind, 5000, limit);
        const routed = await Promise.all(
          places.map(async (p, i) => {
            if (i >= withRoutes) return p;
            try {
              const route = direction === 'toCustomer' ? await fetchRoute(p.coords, center) : await fetchRoute(center, p.coords);
              return { ...p, route };
            } catch {
              return p; // keep the place even if routing fails
            }
          }),
        );
        if (!cancelled) setState({ loading: false, places: routed });
      } catch (e) {
        if (!cancelled) setState({ loading: false, places: [], error: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [center?.latitude, center?.longitude, kind, limit, withRoutes, direction, enabled, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
