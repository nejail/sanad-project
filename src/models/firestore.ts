/**
 * Planned Firebase (Cloud Firestore) structure for SANAD, with typed documents and the
 * converters between app structs (src/models/types.ts) and stored documents.
 *
 * The prototype keeps data on the device (AsyncStorage); these types define exactly what
 * moves to Firestore in the next sprint, so screens do not change when the backend arrives.
 * Phone OTP sign-in moves to Firebase Authentication, so there is no OTP collection.
 *
 *   users/{uid}                          UserDoc
 *   users/{uid}/cars/{carId}             CarDoc
 *   users/{uid}/addresses/{addressId}    AddressDoc
 *   providers/{providerId}               ProviderDoc
 *   services/{serviceId}                 ServiceDoc   (catalogue and prices, editable without an app update)
 *   orders/{orderId}                     OrderDoc
 *   orders/{orderId}/tracking/live       TrackingDoc  (written by the provider app every few seconds)
 *   reviews/{reviewId}                   ReviewDoc
 */
import { Address, Car, Order, OrderStatus, Quote, ServiceDefinition, ServiceId, User } from './types';

/** Stand-ins for Firestore's GeoPoint and Timestamp so the models compile without the SDK. */
export interface GeoPointLike {
  latitude: number;
  longitude: number;
}
export type TimestampLike = string; // ISO 8601 here; firebase.firestore.Timestamp in the app

export const COLLECTIONS = {
  users: 'users',
  cars: (uid: string) => `users/${uid}/cars`,
  addresses: (uid: string) => `users/${uid}/addresses`,
  providers: 'providers',
  services: 'services',
  orders: 'orders',
  tracking: (orderId: string) => `orders/${orderId}/tracking`,
  reviews: 'reviews',
} as const;

export interface UserDoc {
  phone: string; // E.164, e.g. +97450123456 (verified by Firebase Auth)
  name: string;
  createdAt: TimestampLike;
  defaultCarId: string | null;
  defaultAddressId: string | null;
  firstWashUsed: boolean;
  pushToken?: string;
}

export interface CarDoc {
  make: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  fuel: string;
  isDefault: boolean;
  lastServiceAt: TimestampLike | null;
}

export interface AddressDoc {
  label: string;
  line: string;
  landmark: string | null;
  location: GeoPointLike;
  isDefault: boolean;
}

export interface ProviderDoc {
  name: string; // technician
  businessName: string; // e.g. garage name from OpenStreetMap
  osmId: string | null; // link to the Overpass place, e.g. "node/123"
  services: ServiceId[];
  phone: string;
  vehicle: string;
  rating: number;
  ratingCount: number;
  base: GeoPointLike;
  lastLocation: GeoPointLike | null;
  geohash: string | null; // for "providers near me" queries
  isOnline: boolean;
}

export type ServiceDoc = Omit<ServiceDefinition, 'id'> & { active: boolean };

export interface OrderDoc {
  customerId: string;
  providerId: string | null; // null until a provider accepts
  serviceId: ServiceId;
  optionId: string;
  title: string;
  car: { id: string; label: string };
  address: { label: string; line: string; location: GeoPointLike };
  schedule: { kind: 'asap' | 'later'; date: string | null; time: string | null };
  quote: Quote & { currency: 'QAR' };
  payment: { method: 'cash' | 'card'; status: 'unpaid' | 'paid' };
  promoApplied: boolean;
  towTo: { name: string; location: GeoPointLike; distanceKm: number } | null;
  photoPath: string | null; // Cloud Storage path, e.g. orders/{orderId}/photo.jpg
  notes: string | null;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: TimestampLike }[];
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface TrackingDoc {
  location: GeoPointLike;
  heading: number | null;
  etaMin: number | null;
  updatedAt: TimestampLike;
}

export interface ReviewDoc {
  orderId: string;
  providerId: string;
  customerId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  createdAt: TimestampLike;
}

export const toE164 = (phone: string) => `+974${phone}`;
export const fromE164 = (phone: string) => phone.replace(/^\+974/, '');

export function userToDoc(u: User, cars: Car[], addresses: Address[], firstWashUsed: boolean): UserDoc {
  return {
    phone: toE164(u.phone),
    name: u.name,
    createdAt: u.createdAt,
    defaultCarId: cars.find((c) => c.isDefault)?.id ?? null,
    defaultAddressId: addresses.find((a) => a.isDefault)?.id ?? null,
    firstWashUsed,
  };
}

export function userFromDoc(d: UserDoc): User {
  return { phone: fromE164(d.phone), name: d.name, createdAt: d.createdAt };
}

export function carToDoc(c: Car): CarDoc {
  return {
    make: c.make, model: c.model, year: Number(c.year), plate: c.plate, color: c.color, fuel: c.fuel,
    isDefault: c.isDefault, lastServiceAt: null,
  };
}

export function carFromDoc(id: string, d: CarDoc): Car {
  return { id, make: d.make, model: d.model, year: String(d.year), plate: d.plate, color: d.color, fuel: d.fuel, isDefault: d.isDefault };
}

export function addressToDoc(a: Address): AddressDoc {
  return { label: a.label, line: a.line, landmark: a.landmark ?? null, location: a.coords, isDefault: a.isDefault };
}

export function addressFromDoc(id: string, d: AddressDoc): Address {
  return { id, label: d.label, line: d.line, landmark: d.landmark ?? undefined, coords: d.location, isDefault: d.isDefault };
}

export function orderToDoc(o: Order, customerId: string, providerId: string | null = null): OrderDoc {
  return {
    customerId,
    providerId,
    serviceId: o.serviceId,
    optionId: o.optionId,
    title: o.title,
    car: { id: o.carId, label: o.carLabel },
    address: { label: o.address.label, line: o.address.line, location: o.address.coords },
    schedule: { kind: o.schedule.kind, date: o.schedule.date ?? null, time: o.schedule.time ?? null },
    quote: { ...o.quote, currency: 'QAR' },
    payment: { method: o.payment, status: 'unpaid' },
    promoApplied: !!o.promoApplied,
    towTo: o.towTo ? { name: o.towTo.name, location: o.towTo.coords, distanceKm: o.towTo.distanceKm } : null,
    photoPath: o.photoUri ? `orders/${o.id}/photo.jpg` : null,
    notes: o.notes ?? null,
    status: o.status,
    statusHistory: [{ status: o.status, at: o.createdAt }],
    createdAt: o.createdAt,
    updatedAt: o.createdAt,
  };
}
