/**
 * Provider side (V2 feature 4): what a technician can do with a job, step by step.
 * Pure logic shared by Provider Mode on this phone and the Firestore provider repository.
 */
import { withStatus } from './tracking';
import { Order, OrderStatus, Provider, ServiceId } from './types';

/** A technician's profile, from providers/{uid} (or a test profile on this phone). */
export interface ProviderProfile {
  id: string;
  name: string;
  businessName: string;
  phone: string; // E.164 or 8-digit Qatar number
  vehicle: string;
  vehiclePlate?: string;
  rating: number;
  services: ServiceId[];
  isOnline: boolean;
  /** True for profiles registered by SANAD in the providers collection; false for the test profile. */
  verified: boolean;
}

/** The next button a technician sees for a job they have accepted, or null when there is nothing left to do. */
export function nextProviderStep(status: OrderStatus): { label: string; next: OrderStatus; icon: string } | null {
  switch (status) {
    case 'accepted':
      return { label: 'Start Driving to Customer', next: 'on_the_way', icon: 'navigate-outline' };
    case 'on_the_way':
      return { label: "I've Arrived", next: 'arrived', icon: 'flag-outline' };
    case 'arrived':
      return { label: 'Mark Job as Done', next: 'done', icon: 'checkmark-done-outline' };
    default:
      return null;
  }
}

/** True when a technician may move a job from `from` to `to` (one step at a time, never backwards). */
export function canProviderMove(from: OrderStatus, to: OrderStatus): boolean {
  if (from === 'confirmed') return to === 'accepted';
  return nextProviderStep(from)?.next === to;
}

/** The technician details copied onto an order when they accept it. */
export function providerOnOrder(p: ProviderProfile): Provider {
  return { id: p.id, name: p.name, phone: p.phone, vehicle: p.vehicle, vehiclePlate: p.vehiclePlate, rating: p.rating, verified: p.verified };
}

/** The order after a technician accepts it: their details, the Accepted status and when it happened. */
export function acceptJob(order: Order, profile: ProviderProfile, at: string): Order {
  if (order.status !== 'confirmed') throw new Error('This job has already been taken.');
  return {
    ...withStatus(order, 'accepted', at),
    acceptedAt: at,
    provider: { ...providerOnOrder(profile), base: order.provider.base, etaMin: order.provider.etaMin },
  };
}

/** The order after the technician's next step (on the way, arrived, done). */
export function advanceJob(order: Order, to: OrderStatus, at: string): Order {
  if (!canProviderMove(order.status, to)) throw new Error(`A job that is ${order.status.replace('_', ' ')} cannot move to ${to.replace('_', ' ')}.`);
  return withStatus(order, to, at);
}

/** Jobs a technician can take: waiting for acceptance and for a service they offer, oldest first. */
export function openJobsFor(orders: Order[], services?: ServiceId[]): Order[] {
  return orders
    .filter((o) => o.status === 'confirmed' && (!services?.length || services.includes(o.serviceId)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** A technician's own jobs: active ones first (newest first), then finished ones. */
export function myJobs(orders: Order[], providerId: string): Order[] {
  const rank = (o: Order) => (o.status === 'done' || o.status === 'cancelled' ? 1 : 0);
  return orders
    .filter((o) => o.provider.id === providerId && o.status !== 'confirmed')
    .sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
}
