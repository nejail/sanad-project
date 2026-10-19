import { Coordinates, OrderStatus } from './types';

export const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'done', label: 'Done' },
];

export function statusIndex(status: OrderStatus): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

/** Linear interpolation between the provider's start point and the customer. */
export function interpolate(from: Coordinates, to: Coordinates, t: number): Coordinates {
  const k = Math.min(1, Math.max(0, t));
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * k,
    longitude: from.longitude + (to.longitude - from.longitude) * k,
  };
}

/** Start the simulated provider roughly 3 km north-east of the customer. */
export function providerStart(dest: Coordinates): Coordinates {
  return { latitude: dest.latitude + 0.02, longitude: dest.longitude + 0.018 };
}

/**
 * Status for a simulated job that started `elapsed` ms ago and is expected to take
 * `travelMs` to arrive. Used by the Track Order screen and its unit tests.
 */
export function simulatedStatus(elapsed: number, travelMs: number): { status: OrderStatus; progress: number } {
  const confirmMs = Math.min(4000, travelMs * 0.1);
  if (elapsed < confirmMs) return { status: 'confirmed', progress: 0 };
  const progress = Math.min(1, (elapsed - confirmMs) / travelMs);
  return { status: progress >= 1 ? 'arrived' : 'on_the_way', progress };
}
