import { buildQuote } from './pricing';
import { Address, Car, Order, User } from './types';

/**
 * Demo account used in the wireframes. Signing in with +974 5012 3456 loads these
 * cars, addresses and orders, which is how a returning user lands on Home with their
 * registered cars already loaded. Any other number goes through registration.
 */
export const DEMO_PHONE = '50123456';

export const DEMO_USER: User = { phone: DEMO_PHONE, name: 'Hassan', createdAt: '2026-09-01T09:00:00.000Z' };

export const DEMO_CARS: Car[] = [
  { id: 'car-1', make: 'Toyota', model: 'Land Cruiser', year: '2023', plate: 'QA-1234', color: 'White', fuel: 'Gasoline', isDefault: true, lastService: '30 days ago' },
  { id: 'car-2', make: 'Nissan', model: 'Patrol', year: '2021', plate: 'QA-5678', color: 'Black', fuel: 'Gasoline', isDefault: false, lastService: '5 days ago' },
];

export const DEMO_ADDRESSES: Address[] = [
  { id: 'addr-1', label: 'Home', line: 'Al Sadd St, Building 12, Doha', coords: { latitude: 25.2847, longitude: 51.4973 }, isDefault: true },
  { id: 'addr-2', label: 'CMU-Q', line: 'Education City, Al Rayyan', coords: { latitude: 25.3155, longitude: 51.439 }, isDefault: false },
  { id: 'addr-3', label: 'Office', line: 'West Bay, Doha', coords: { latitude: 25.3233, longitude: 51.531 }, isDefault: false },
];

const provider = { name: 'Ahmed Al-Mansouri', rating: 4.9, vehicle: 'Toyota Camry', phone: '+97455550123' };

export const DEMO_ORDERS: Order[] = [
  {
    id: 'SND-1042', serviceId: 'battery', optionId: 'jump', title: 'Battery Jump Start', carId: 'car-1',
    carLabel: 'Land Cruiser · QA-1234', address: DEMO_ADDRESSES[0], schedule: { kind: 'asap' },
    quote: buildQuote({ serviceId: 'battery', optionId: 'jump' }), payment: 'cash', status: 'on_the_way',
    createdAt: new Date().toISOString(), provider,
  },
  {
    id: 'SND-1031', serviceId: 'carwash', optionId: 'full', title: 'Car Wash', carId: 'car-2',
    carLabel: 'Patrol · QA-5678', address: DEMO_ADDRESSES[0], schedule: { kind: 'later', date: '2026-09-21', time: '12 PM' },
    quote: buildQuote({ serviceId: 'carwash', optionId: 'full' }), payment: 'cash', status: 'done',
    createdAt: '2026-09-21T09:00:00.000Z', provider,
  },
  {
    id: 'SND-1017', serviceId: 'tire', optionId: 'flat', title: 'Tire · Flat Fix', carId: 'car-1',
    carLabel: 'Land Cruiser · QA-1234', address: DEMO_ADDRESSES[1], schedule: { kind: 'asap' },
    quote: buildQuote({ serviceId: 'tire', optionId: 'flat' }), payment: 'cash', status: 'done',
    createdAt: '2026-09-12T15:00:00.000Z', provider,
  },
];
