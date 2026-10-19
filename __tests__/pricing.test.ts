import { buildQuote, distanceKm, etaMinutes, formatQAR, isFirstWashFree } from '../src/models/pricing';

describe('buildQuote', () => {
  it('matches the wireframe total for a battery jump start (50 + 5% VAT)', () => {
    const q = buildQuote({ serviceId: 'battery', optionId: 'jump' });
    expect(q.subtotal).toBe(50);
    expect(q.vat).toBe(2.5);
    expect(q.total).toBe(52.5);
    expect(q.isEstimate).toBe(false);
  });

  it('prices fuel per litre plus a delivery fee (40 L of Super 91 = 93.45)', () => {
    const q = buildQuote({ serviceId: 'fuel', optionId: 'super91', litres: 40 });
    expect(q.lines[0].amount).toBe(89);
    expect(q.total).toBe(93.45);
  });

  it('adds car wash add-ons to the package price', () => {
    const q = buildQuote({ serviceId: 'carwash', optionId: 'full', addOnIds: ['interior', 'engine'] });
    expect(q.subtotal).toBe(65 + 25 + 30);
    expect(q.total).toBe(126);
  });

  it('estimates towing as base fee plus 5 QAR per km', () => {
    const q = buildQuote({ serviceId: 'emergency', optionId: 'towing', distanceKm: 2 });
    expect(q.subtotal).toBe(210);
    expect(q.isEstimate).toBe(true);
  });

  it('treats non-towing emergency options as fixed prices', () => {
    const q = buildQuote({ serviceId: 'emergency', optionId: 'lockout' });
    expect(q.subtotal).toBe(100);
    expect(q.isEstimate).toBe(false);
  });

  it('marks "from" prices such as battery replacement (250+) as estimates', () => {
    expect(buildQuote({ serviceId: 'battery', optionId: 'replace' }).isEstimate).toBe(true);
  });

  it('makes the first car wash package free but still charges add-ons', () => {
    const free = buildQuote({ serviceId: 'carwash', optionId: 'full', firstWashFree: true });
    expect(free.total).toBe(0);
    const withAddOn = buildQuote({ serviceId: 'carwash', optionId: 'vip', addOnIds: ['interior'], firstWashFree: true });
    expect(withAddOn.subtotal).toBe(25);
    expect(withAddOn.total).toBe(26.25);
  });

  it('only applies the launch special to car washes', () => {
    expect(buildQuote({ serviceId: 'battery', optionId: 'jump', firstWashFree: true }).total).toBe(52.5);
  });

  it('offers the free wash until an order has used it', () => {
    expect(isFirstWashFree([])).toBe(true);
    expect(isFirstWashFree([{ status: 'done' }])).toBe(true); // older orders made before the promo
    expect(isFirstWashFree([{ status: 'done', promoApplied: true }])).toBe(false);
    expect(isFirstWashFree([{ status: 'cancelled', promoApplied: true }])).toBe(true);
  });

  it('formats QAR with two decimals', () => {
    expect(formatQAR(52.5)).toBe('52.50 QAR');
  });
});

describe('distance and ETA', () => {
  it('computes a realistic distance between Al Sadd and Education City (about 6 km)', () => {
    const km = distanceKm({ latitude: 25.2847, longitude: 51.4973 }, { latitude: 25.3155, longitude: 51.439 });
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(8);
  });

  it('never returns an ETA below 3 minutes', () => {
    expect(etaMinutes(0)).toBe(4);
    expect(etaMinutes(10)).toBe(24);
  });
});
