import { Order, PlaceRef } from './types';

/** A garage the driver has towed to before, with how often and when it was last used. */
export interface UsedGarage extends PlaceRef {
  timesUsed: number;
  lastUsed: string; // ISO date of the most recent tow there
}

/**
 * The garages a driver has towed to before, most used first (ties: most recent first).
 * Cancelled orders are ignored. Shown on Review Order as quick choices next to the nearest garage.
 */
export function frequentGarages(orders: Order[], limit = 3): UsedGarage[] {
  const byId = new Map<string, UsedGarage>();
  for (const o of orders) {
    if (!o.towTo || o.status === 'cancelled') continue;
    const { id, name, coords, phone } = o.towTo;
    const seen = byId.get(id);
    if (seen) {
      seen.timesUsed += 1;
      if (o.createdAt > seen.lastUsed) seen.lastUsed = o.createdAt;
    } else {
      byId.set(id, { id, name, coords, phone, timesUsed: 1, lastUsed: o.createdAt });
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.timesUsed - a.timesUsed || b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, limit);
}

/** Short label for a used garage, e.g. "Used 3 times" or "Used before". */
export function usedGarageLabel(g: UsedGarage): string {
  return g.timesUsed > 1 ? `Used ${g.timesUsed} times` : 'Used before';
}
