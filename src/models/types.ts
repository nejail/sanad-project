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

export type OrderStatus = 'confirmed' | 'on_the_way' | 'arrived' | 'done' | 'cancelled';

export interface Provider {
  name: string;
  rating: number;
  vehicle: string;
  phone: string;
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
  status: OrderStatus;
  createdAt: string;
  provider: Provider;
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
  schedule?: Schedule;
  payment: 'cash' | 'card';
  promo?: string;
}
