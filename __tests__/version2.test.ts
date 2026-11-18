import { nearestByRoad, roadKm } from '../src/models/garages';
import { buildQuote, towOptionLabel, towPriceExplanation } from '../src/models/pricing';

describe('tow price shown from the first price screen (V2 feature 1)', () => {
  it('picks the garage nearest by road, not in a straight line', () => {
    const places = [
      { id: 'a', distanceKm: 2, route: { distanceKm: 9 } },
      { id: 'b', distanceKm: 4, route: { distanceKm: 5 } },
      { id: 'c', distanceKm: 3 },
    ];
    expect(nearestByRoad(places)?.id).toBe('c');
    expect(roadKm(places[0])).toBe(9);
    expect(nearestByRoad([])).toBeUndefined();
  });

  it('explains the formula with an example before the distance is known', () => {
    expect(towPriceExplanation(200)).toBe(
      'Towing costs 200 QAR plus 5 QAR for every km to the garage. For example, 10 km costs 250 QAR before VAT.',
    );
  });

  it('adds the distance to the base fee once the nearest garage is found', () => {
    expect(towPriceExplanation(200, 6.8, 'Al Sadd Garage')).toBe(
      '200 QAR base fee + 34 QAR for 6.8 km to Al Sadd Garage = 234 QAR before VAT.',
    );
    const quote = buildQuote({ serviceId: 'emergency', optionId: 'towing', distanceKm: 6.8 });
    expect(quote.subtotal).toBe(234);
    expect(quote.total).toBe(245.7);
    expect(towOptionLabel(quote, true, '200+')).toBe('≈ 246 QAR');
    expect(towOptionLabel(buildQuote({ serviceId: 'emergency', optionId: 'towing' }), false, '200+')).toBe('200+');
  });
});

import { SMS_TYPICAL_WAIT_SECONDS, smsWaitHint } from '../src/models/otp';

describe('SMS wait guidance (V2 feature 3)', () => {
  it('says a short wait is normal at first', () => {
    const hint = smsWaitHint(5);
    expect(hint.late).toBe(false);
    expect(hint.detail).toMatch(/within a minute/);
  });
  it('gives practical tips once the wait is longer than usual', () => {
    expect(smsWaitHint(SMS_TYPICAL_WAIT_SECONDS - 1).late).toBe(false);
    const hint = smsWaitHint(SMS_TYPICAL_WAIT_SECONDS);
    expect(hint.late).toBe(true);
    expect(hint.detail).toMatch(/Resend code/);
  });
});
