import { getOption, getService, orderTitle } from '../src/models/catalog';
import { frequentGarages, usedGarageLabel } from '../src/models/garages';
import { buildQuote } from '../src/models/pricing';
import { Order } from '../src/models/types';
import { resolveCarColor } from '../src/models/validation';

/** A minimal towing order to a garage, for the "your garages" tests. */
function tow(id: string, name: string, createdAt: string, status: Order['status'] = 'done'): Order {
  return {
    id: `SND-${createdAt}`, serviceId: 'emergency', optionId: 'towing', title: 'Emergency · Towing', carId: 'c1', carLabel: 'Car',
    address: { id: 'a', label: 'Home', line: 'Doha', coords: { latitude: 25.28, longitude: 51.53 }, isDefault: true },
    schedule: { kind: 'asap' }, quote: { lines: [], subtotal: 0, vat: 0, total: 0, isEstimate: true }, payment: 'cash', status, createdAt,
    towTo: { id, name, coords: { latitude: 25.3, longitude: 51.5 }, distanceKm: 4 },
    provider: { name: 'Ahmed', rating: 4.9, vehicle: 'Flatbed', phone: '+97455550123' },
  };
}

describe('your garages (last and most used)', () => {
  it('lists the most used garage first, then the most recent', () => {
    const orders = [
      tow('g1', 'Al Sadd Garage', '2026-10-01T10:00:00Z'),
      tow('g2', 'Industrial Area Motors', '2026-10-05T10:00:00Z'),
      tow('g1', 'Al Sadd Garage', '2026-10-03T10:00:00Z'),
      tow('g3', 'Lusail Auto', '2026-10-09T10:00:00Z'),
    ];
    const used = frequentGarages(orders);
    expect(used.map((g) => g.id)).toEqual(['g1', 'g3', 'g2']);
    expect(used[0].timesUsed).toBe(2);
    expect(used[0].lastUsed).toBe('2026-10-03T10:00:00Z');
    expect(usedGarageLabel(used[0])).toBe('Used 2 times');
    expect(usedGarageLabel(used[1])).toBe('Used before');
  });

  it('ignores cancelled tows and orders without a garage, and respects the limit', () => {
    const plain = { ...tow('x', 'x', '2026-10-01T00:00:00Z'), towTo: undefined };
    const orders = [tow('g1', 'A', '2026-10-01T00:00:00Z', 'cancelled'), plain, tow('g2', 'B', '2026-10-02T00:00:00Z'), tow('g3', 'C', '2026-10-03T00:00:00Z')];
    expect(frequentGarages(orders).map((g) => g.id)).toEqual(['g3', 'g2']);
    expect(frequentGarages(orders, 1)).toHaveLength(1);
    expect(frequentGarages([])).toEqual([]);
  });
});

describe('car color "Other"', () => {
  it('keeps a chosen chip as it is', () => {
    expect(resolveCarColor('Silver', 'ignored')).toBe('Silver');
  });
  it('uses the typed color when "Other" is chosen, tidied up', () => {
    expect(resolveCarColor('Other', '  matte   green ')).toBe('Matte green');
  });
  it('rejects an empty or too long typed color', () => {
    expect(resolveCarColor('Other', ' ')).toBeNull();
    expect(resolveCarColor('Other', 'x'.repeat(31))).toBeNull();
  });
});

describe('towing found and priced from the nearest garage', () => {
  it('shows only the base fee, as an estimate, until the garage distance is known', () => {
    const q = buildQuote({ serviceId: 'emergency', optionId: 'towing' });
    expect(q.lines).toEqual([{ label: 'Towing base fee', amount: 200 }]);
    expect(q.isEstimate).toBe(true);
  });
  it('adds 5 QAR per km once the nearest garage is chosen', () => {
    const q = buildQuote({ serviceId: 'emergency', optionId: 'towing', distanceKm: 4.2 });
    expect(q.lines[1]).toEqual({ label: 'Distance to garage (4.2 km × 5 QAR)', amount: 21 });
    expect(q.subtotal).toBe(221);
  });
  it('names towing on the Home tile and renames General Help to Unsure', () => {
    expect(getService('emergency').shortTitle).toContain('Towing');
    expect(getOption('emergency', 'general').title).toBe('Unsure');
    expect(orderTitle('emergency', 'towing')).toBe('Emergency · Towing');
  });
});
