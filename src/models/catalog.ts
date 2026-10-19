import { ServiceDefinition, ServiceId } from './types';

// Service catalogue and prices as shown in the high-fidelity wireframes.
export const SERVICES: ServiceDefinition[] = [
  {
    id: 'fuel',
    title: 'Fuel Delivery',
    shortTitle: 'Fuel Delivery',
    fromLabel: 'from 1.85/L',
    icon: 'water-outline',
    prompt: 'Choose fuel type',
    pricing: 'perLitre',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'e.g. car parked in basement',
    options: [
      { id: 'super91', title: 'Super 91', subtitle: 'Most cars', price: 1.85, priceLabel: '1.85/L', icon: 'speedometer-outline' },
      { id: 'premium95', title: 'Premium 95', subtitle: 'High performance engines', price: 2.1, priceLabel: '2.10/L', icon: 'speedometer-outline' },
      { id: 'diesel', title: 'Diesel', subtitle: 'Trucks and SUVs', price: 1.95, priceLabel: '1.95/L', icon: 'speedometer-outline' },
    ],
  },
  {
    id: 'carwash',
    title: 'Car Wash',
    shortTitle: 'Car Wash',
    fromLabel: 'from 35 QAR',
    icon: 'water',
    prompt: 'Choose a package',
    pricing: 'fixed',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'e.g. car parked in basement',
    options: [
      { id: 'express', title: 'Express', subtitle: 'Exterior wash', price: 35, priceLabel: '35 QAR', icon: 'water-outline' },
      { id: 'full', title: 'Full Service', subtitle: 'Inside and out', price: 65, priceLabel: '65 QAR', icon: 'water' },
      { id: 'vip', title: 'VIP Detail', subtitle: 'Full detail and wax', price: 120, priceLabel: '120 QAR', icon: 'star-outline' },
    ],
    addOns: [
      { id: 'interior', title: 'Interior deep clean', price: 25 },
      { id: 'engine', title: 'Engine bay', price: 30 },
      { id: 'ceramic', title: 'Ceramic coating', price: 80 },
    ],
  },
  {
    id: 'battery',
    title: 'Battery Service',
    shortTitle: 'Battery',
    fromLabel: 'from 50 QAR',
    icon: 'battery-charging-outline',
    prompt: 'Choose a service',
    pricing: 'fixed',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'e.g. car parked in basement',
    options: [
      { id: 'jump', title: 'Jump Start', subtitle: "Car won't start", price: 50, priceLabel: '50 QAR', icon: 'flash-outline' },
      { id: 'test', title: 'Battery Test', subtitle: 'Free health check', price: 0, priceLabel: 'Free', icon: 'checkmark' },
      { id: 'replace', title: 'Replacement', subtitle: 'New battery fitted on the spot', price: 250, priceLabel: '250+', icon: 'add' },
    ],
  },
  {
    id: 'tire',
    title: 'Tire Service',
    shortTitle: 'Tire Service',
    fromLabel: 'from 60 QAR',
    icon: 'aperture-outline',
    prompt: 'Choose a service',
    pricing: 'fixed',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'e.g. front left tire is flat',
    options: [
      { id: 'flat', title: 'Flat Fix', subtitle: 'Repair a puncture', price: 80, priceLabel: '80 QAR', icon: 'aperture-outline' },
      { id: 'change', title: 'Tire Change', subtitle: 'Per tire, tire not included', price: 60, priceLabel: '60 QAR', icon: 'swap-horizontal' },
      { id: 'rotation', title: 'Rotation', subtitle: 'All four tires', price: 100, priceLabel: '100 QAR', icon: 'sync-outline' },
    ],
  },
  {
    id: 'oil',
    title: 'Oil Change',
    shortTitle: 'Oil Change',
    fromLabel: 'from 120 QAR',
    icon: 'color-fill-outline',
    prompt: 'Choose oil type',
    pricing: 'fixed',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'e.g. last change was 8,000 km ago',
    options: [
      { id: 'conventional', title: 'Conventional', subtitle: 'Standard engines', price: 120, priceLabel: '120 QAR', icon: 'color-fill-outline' },
      { id: 'blend', title: 'Synthetic Blend', subtitle: 'Better protection', price: 180, priceLabel: '180 QAR', icon: 'color-fill-outline' },
      { id: 'synthetic', title: 'Full Synthetic', subtitle: 'Best performance', price: 250, priceLabel: '250 QAR', icon: 'color-fill-outline' },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency 24/7',
    shortTitle: 'Emergency 24/7',
    fromLabel: 'from 100 QAR',
    icon: 'warning-outline',
    accent: 'danger',
    prompt: 'What happened?',
    pricing: 'towing',
    notesLabel: 'Where are you? (optional)',
    notesPlaceholder: 'e.g. Salwa Road, near exit 12',
    options: [
      { id: 'towing', title: 'Towing', subtitle: 'Base fee + 5 QAR per km', price: 200, priceLabel: '200+', icon: 'car-outline' },
      { id: 'lockout', title: 'Lockout', subtitle: 'Keys locked inside the car', price: 100, priceLabel: '100 QAR', icon: 'key-outline' },
      { id: 'general', title: 'General Help', subtitle: "Not sure what's wrong", price: 150, priceLabel: '150 QAR', icon: 'help-circle-outline' },
    ],
  },
];

export const HOME_SERVICE_ORDER: ServiceId[] = ['fuel', 'carwash', 'battery', 'tire', 'oil', 'emergency'];

export const FUEL_DELIVERY_FEE = 15;
export const TOWING_PER_KM = 5;
export const VAT_RATE = 0.05;

export function getService(id: ServiceId): ServiceDefinition {
  const s = SERVICES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown service: ${id}`);
  return s;
}

export function getOption(serviceId: ServiceId, optionId: string) {
  const opt = getService(serviceId).options.find((o) => o.id === optionId);
  if (!opt) throw new Error(`Unknown option ${optionId} for ${serviceId}`);
  return opt;
}

/** Title used on orders, e.g. "Battery Jump Start" or "Tire · Flat Fix". */
export function orderTitle(serviceId: ServiceId, optionId: string): string {
  const s = getService(serviceId);
  const o = getOption(serviceId, optionId);
  if (serviceId === 'battery') return `Battery ${o.title}`;
  if (serviceId === 'fuel') return `Fuel Delivery · ${o.title}`;
  if (serviceId === 'carwash') return `Car Wash · ${o.title}`;
  return `${s.shortTitle.replace(' Service', '')} · ${o.title}`;
}
