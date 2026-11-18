import { Coordinates, Order, OrderStatus, StatusChange } from './types';

export const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'confirmed', label: 'Requested' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'done', label: 'Done' },
];

/** Labels for order status badges (Orders tab, Provider Mode). */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  confirmed: 'Requested',
  accepted: 'Accepted',
  on_the_way: 'On the way',
  arrived: 'Arrived',
  done: 'Done',
  cancelled: 'Cancelled',
};

export function statusIndex(status: OrderStatus): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

/** True while the order still needs the driver's attention (not done or cancelled). */
export function isActiveStatus(status: OrderStatus): boolean {
  return status !== 'done' && status !== 'cancelled';
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

/** How long the simulation waits for a technician, then shows "Accepted", before driving. */
function simulationPhases(travelMs: number) {
  const requestMs = Math.min(4000, travelMs * 0.1);
  const acceptedMs = Math.min(4500, travelMs * 0.1);
  return { requestMs, acceptedMs, driveFrom: requestMs + acceptedMs };
}

/**
 * Status for a simulated job that started `elapsed` ms ago and is expected to take
 * `travelMs` to arrive: Requested, then Accepted (so drivers see the acceptance clearly),
 * then On the way, then Arrived. Used by the Track Order screen and its unit tests.
 */
export function simulatedStatus(elapsed: number, travelMs: number): { status: OrderStatus; progress: number } {
  const { requestMs, driveFrom } = simulationPhases(travelMs);
  if (elapsed < requestMs) return { status: 'confirmed', progress: 0 };
  if (elapsed < driveFrom) return { status: 'accepted', progress: 0 };
  const progress = Math.min(1, (elapsed - driveFrom) / travelMs);
  return { status: progress >= 1 ? 'arrived' : 'on_the_way', progress };
}

/** Where to resume the simulation for an order that already has a status (e.g. the demo order). */
export function simulationOffset(status: OrderStatus, travelMs: number): number {
  const { requestMs, driveFrom } = simulationPhases(travelMs);
  switch (status) {
    case 'accepted':
      return requestMs;
    case 'on_the_way':
      return driveFrom + 1000;
    case 'arrived':
    case 'done':
      return driveFrom + travelMs + 1000;
    default:
      return 0;
  }
}

/** True when the order is moved along by the prototype simulation rather than a real technician. */
export function isSimulated(order: Pick<Order, 'dispatch'>): boolean {
  return order.dispatch !== 'provider';
}

/**
 * Live tracking from the technician's real location is V2 feature 7. Until it is ready the van's
 * movement on the map is always simulated, and Track Order shows a "Demo Mode" badge (feature 10).
 */
export const LIVE_TRACKING_READY = false;

export function showsDemoBadge(order: Pick<Order, 'dispatch'>): boolean {
  return !LIVE_TRACKING_READY || isSimulated(order);
}

/**
 * Progress of the van along the route for an order moved by a real technician: still at the start
 * until they leave, then animated over `travelMs` from the moment they set "On the way".
 */
export function providerProgress(status: OrderStatus, history: StatusChange[] | undefined, now: number, travelMs: number): number {
  if (status === 'arrived' || status === 'done') return 1;
  if (status !== 'on_the_way') return 0;
  const left = [...(history ?? [])].reverse().find((h) => h.status === 'on_the_way');
  if (!left) return 0;
  return Math.min(0.98, Math.max(0, (now - Date.parse(left.at)) / travelMs));
}

/** Adds a status change to the history (keeps the old history untouched). */
export function withStatus<T extends Pick<Order, 'status' | 'statusHistory' | 'createdAt'>>(order: T, status: OrderStatus, at: string): T & { statusHistory: StatusChange[] } {
  const history = order.statusHistory?.length ? order.statusHistory : [{ status: order.status, at: order.createdAt }];
  return { ...order, status, statusHistory: [...history, { status, at }] };
}

/** Header text on Track Order for each status. */
export function trackingTitle(status: OrderStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Waiting for a technician to accept';
    case 'accepted':
      return 'Request accepted';
    case 'on_the_way':
      return 'Technician on the way';
    case 'arrived':
      return 'Technician has arrived';
    case 'done':
      return 'Job completed';
    case 'cancelled':
      return 'Order cancelled';
  }
}

/**
 * The notification to show when an order's status changes (V2 feature 12), or null when the
 * change does not need one. Shown wherever the driver is in the app, not only on Track Order.
 */
export function statusNotification(order: Pick<Order, 'id' | 'title' | 'provider' | 'address'>, status: OrderStatus, etaMin?: number): { title: string; body: string } | null {
  const who = order.provider.name;
  switch (status) {
    case 'accepted':
      return { title: 'Request accepted', body: `${who} accepted your ${order.title} request (#${order.id}).` };
    case 'on_the_way':
      return { title: 'Technician on the way', body: `${who} is heading to you${etaMin ? `. ETA ${etaMin} min` : ''}.` };
    case 'arrived':
      return { title: 'Technician arrived', body: `${who} has arrived at ${order.address.label}.` };
    default:
      return null;
  }
}
