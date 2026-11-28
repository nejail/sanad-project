export type ServiceId = 'battery' | 'fuel' | 'carwash' | 'tire' | 'oil' | 'emergency';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface User {
  phone: string; // 8-digit Qatar number without +974
  name: string;
  createdAt: string;
}

export interface Car {
  id: string;
  make: string;
  model: string;
  year: string;
  plate: string;
  color: string;
  fuel: string;
  isDefault: boolean;
  lastService?: string;
}

export interface Address {
  id: string;
  label: 'Home' | 'Office' | 'Other' | string;
  line: string;
  landmark?: string;
  coords: Coordinates;
  isDefault: boolean;
}

export interface ServiceOption {
  id: string;
  title: string;
  subtitle: string;
  price: number; // QAR, or QAR per litre for fuel
  priceLabel: string; // how the price is shown on the option row
  icon: string; // Ionicons name
}

export interface ServiceAddOn {
  id: string;
  title: string;
  price: number;
}

export interface ServiceDefinition {
  id: ServiceId;
  title: string;
  shortTitle: string;
  fromLabel: string;
  icon: string;
  accent?: 'danger';
  prompt: string;
  options: ServiceOption[];
  addOns?: ServiceAddOn[];
  notesLabel: string;
  notesPlaceholder: string;
  pricing: 'fixed' | 'perLitre' | 'towing';
}

export interface Schedule {
  kind: 'asap' | 'later';
  date?: string; // ISO date (yyyy-mm-dd)
  time?: string; // e.g. "3 PM"
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  vat: number;
  total: number;
  isEstimate: boolean;
}

/**
 * 'confirmed' means the request was sent and is waiting for a technician (shown as "Requested");
 * 'accepted' means a technician took the job (V2 feature 6).
 */
export type OrderStatus = 'confirmed' | 'accepted' | 'on_the_way' | 'arrived' | 'done' | 'cancelled';

/** One status change, with when it happened (ISO date). */
export interface StatusChange {
  status: OrderStatus;
  at: string;
}

/** A real place (from the Overpass API) stored on orders: the provider's base or a tow destination. */
export interface PlaceRef {
  id: string;
  name: string;
  coords: Coordinates;
  phone?: string;
}

export interface Provider {
  name: string; // technician / driver
  rating: number;
  vehicle: string;
  phone: string;
  base?: PlaceRef; // business the technician is dispatched from
  etaMin?: number; // driving time from OSRM when the order was placed
  id?: string; // providers/{id} when a real provider accepted the job
  verified?: boolean; // profile checked by SANAD (registered in the providers collection)
  vehiclePlate?: string;
}

export interface Order {
  id: string;
  serviceId: ServiceId;
  optionId: string;
  title: string; // e.g. "Battery Jump Start"
  carId: string;
  carLabel: string;
  address: Address;
  schedule: Schedule;
  quote: Quote;
  payment: 'cash' | 'card';
  notes?: string;
  photoUri?: string;
  promoApplied?: boolean;
  towTo?: PlaceRef & { distanceKm: number };
  status: OrderStatus;
  createdAt: string;
  provider: Provider;
  /**
   * Who moves the order along: 'simulated' (the prototype technician, the default for older orders)
   * or 'provider' (a technician accepts it in Provider Mode and updates the status).
   */
  dispatch?: 'simulated' | 'provider';
  statusHistory?: StatusChange[];
  acceptedAt?: string;
  photoPath?: string; // Cloud Storage path once the car photo is uploaded
  photoUrl?: string; // download URL the technician opens
  customerName?: string;
  customerPhone?: string; // 8-digit Qatar number, so the technician can call the driver
  customerPushToken?: string; // Expo push token, so status changes reach the driver with the app closed
  offeredTo?: string; // providers/{uid} the job is offered to right now (V2 feature 8)
  offeredAt?: string; // when it was offered to them, so it can move on after 2 minutes
  offeredBefore?: string[]; // technicians it was already offered to
}

export interface BookingDraft {
  serviceId?: ServiceId;
  optionId?: string;
  addOnIds: string[];
  litres?: number;
  distanceKm?: number;
  notes?: string;
  photoUri?: string;
  carId?: string;
  address?: Address;
  locationNotes?: string; // what the driver typed to help the technician find them
  schedule?: Schedule;
  payment: 'cash' | 'card';
  promo?: string;
  providerBase?: PlaceRef & { etaMin?: number };
  towTo?: PlaceRef & { distanceKm: number };
}
