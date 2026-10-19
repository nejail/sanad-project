import { SERVICES, getService, orderTitle } from '../src/models/catalog';
import { interpolate, providerStart, simulatedStatus, statusIndex } from '../src/models/tracking';

describe('order tracking simulation', () => {
  const TRAVEL = 45_000;
  it('starts confirmed, then on the way, then arrived', () => {
    expect(simulatedStatus(0, TRAVEL).status).toBe('confirmed');
    expect(simulatedStatus(10_000, TRAVEL).status).toBe('on_the_way');
    expect(simulatedStatus(60_000, TRAVEL)).toEqual({ status: 'arrived', progress: 1 });
  });
  it('moves the provider towards the customer', () => {
    const dest = { latitude: 25.28, longitude: 51.5 };
    const start = providerStart(dest);
    expect(interpolate(start, dest, 1)).toEqual(dest);
    expect(interpolate(start, dest, 0)).toEqual(start);
    expect(interpolate(start, dest, 2)).toEqual(dest);
  });
  it('orders the status steps', () => {
    expect(statusIndex('confirmed')).toBeLessThan(statusIndex('done'));
  });
});

describe('service catalogue', () => {
  it('has the six services from the wireframes, each with three options', () => {
    expect(SERVICES.map((s) => s.id).sort()).toEqual(['battery', 'carwash', 'emergency', 'fuel', 'oil', 'tire']);
    SERVICES.forEach((s) => expect(s.options).toHaveLength(3));
  });
  it('builds readable order titles', () => {
    expect(orderTitle('battery', 'jump')).toBe('Battery Jump Start');
    expect(orderTitle('tire', 'flat')).toBe('Tire · Flat Fix');
  });
  it('throws for unknown services', () => {
    expect(() => getService('nope' as never)).toThrow();
  });
});
