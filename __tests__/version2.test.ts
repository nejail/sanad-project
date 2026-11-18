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

import {
  STATUS_LABEL, isActiveStatus, providerProgress, showsDemoBadge, simulatedStatus, simulationOffset, statusIndex, statusNotification, trackingTitle, withStatus,
} from '../src/models/tracking';

describe('clear acceptance (V2 feature 6)', () => {
  const TRAVEL = 45_000;
  it('the simulation waits for a technician, shows Accepted, then drives', () => {
    expect(simulatedStatus(1_000, TRAVEL).status).toBe('confirmed');
    expect(simulatedStatus(5_000, TRAVEL)).toEqual({ status: 'accepted', progress: 0 });
    expect(simulatedStatus(9_000, TRAVEL).status).toBe('on_the_way');
    expect(statusIndex('confirmed')).toBeLessThan(statusIndex('accepted'));
    expect(statusIndex('accepted')).toBeLessThan(statusIndex('on_the_way'));
  });
  it('resumes a saved order at the right phase', () => {
    for (const s of ['confirmed', 'accepted', 'on_the_way', 'arrived'] as const) {
      expect(simulatedStatus(simulationOffset(s, TRAVEL), TRAVEL).status).toBe(s);
    }
  });
  it('names the waiting and accepted states plainly', () => {
    expect(STATUS_LABEL.confirmed).toBe('Requested');
    expect(trackingTitle('confirmed')).toBe('Waiting for a technician to accept');
    expect(trackingTitle('accepted')).toBe('Request accepted');
    expect(isActiveStatus('accepted')).toBe(true);
    expect(isActiveStatus('done')).toBe(false);
  });
  it('records every status change with its time', () => {
    const order: { status: 'confirmed'; createdAt: string; statusHistory?: never[] } = { status: 'confirmed', createdAt: '2026-11-18T10:00:00.000Z' };
    const accepted = withStatus(order, 'accepted', '2026-11-18T10:01:00.000Z');
    expect(accepted.status).toBe('accepted');
    expect(accepted.statusHistory).toEqual([
      { status: 'confirmed', at: '2026-11-18T10:00:00.000Z' },
      { status: 'accepted', at: '2026-11-18T10:01:00.000Z' },
    ]);
    expect(order).not.toHaveProperty('statusHistory');
  });
});

describe('Demo Mode badge (V2 feature 10)', () => {
  it('shows while the van movement is simulated', () => {
    expect(showsDemoBadge({})).toBe(true);
    expect(showsDemoBadge({ dispatch: 'simulated' })).toBe(true);
    // Live tracking (feature 7) is not ready, so real-provider orders still show it.
    expect(showsDemoBadge({ dispatch: 'provider' })).toBe(true);
  });
  it('moves a real technician only once they set On the way', () => {
    const left = Date.parse('2026-11-18T10:00:00Z');
    const history = [{ status: 'on_the_way' as const, at: '2026-11-18T10:00:00Z' }];
    expect(providerProgress('accepted', history, left + 10_000, 40_000)).toBe(0);
    expect(providerProgress('on_the_way', history, left + 10_000, 40_000)).toBeCloseTo(0.25);
    expect(providerProgress('on_the_way', history, left + 99_000, 40_000)).toBeLessThan(1);
    expect(providerProgress('arrived', history, left, 40_000)).toBe(1);
  });
});

describe('status notifications (V2 feature 12)', () => {
  const order = {
    id: 'SND-1050', title: 'Battery Jump Start',
    provider: { name: 'Ahmed', rating: 4.9, vehicle: 'Van', phone: '+97455550123' },
    address: { id: 'a', label: 'Home', line: 'Doha', coords: { latitude: 25.3, longitude: 51.5 }, isDefault: true },
  };
  it('announces acceptance, departure and arrival', () => {
    expect(statusNotification(order, 'accepted')).toEqual({ title: 'Request accepted', body: 'Ahmed accepted your Battery Jump Start request (#SND-1050).' });
    expect(statusNotification(order, 'on_the_way', 12)?.body).toBe('Ahmed is heading to you. ETA 12 min.');
    expect(statusNotification(order, 'arrived')?.title).toBe('Technician arrived');
  });
  it('stays quiet for other changes', () => {
    expect(statusNotification(order, 'confirmed')).toBeNull();
    expect(statusNotification(order, 'done')).toBeNull();
  });
});

import { orderPhotoPath, uploadOrderPhoto } from '../src/services/photoUpload';

describe('car photo upload (V2 feature 13)', () => {
  it('stores the photo in the driver\'s own folder and returns its download URL', async () => {
    const calls: [string, string, string][] = [];
    const api = { upload: async (path: string, uri: string, type: string) => { calls.push([path, uri, type]); return `https://storage.test/${path}`; } };
    const result = await uploadOrderPhoto('uid-1', 'SND-1050', 'file:///tmp/car.jpg', api);
    expect(orderPhotoPath('uid-1', 'SND-1050')).toBe('order-photos/uid-1/SND-1050.jpg');
    expect(calls).toEqual([['order-photos/uid-1/SND-1050.jpg', 'file:///tmp/car.jpg', 'image/jpeg']]);
    expect(result).toEqual({ path: 'order-photos/uid-1/SND-1050.jpg', url: 'https://storage.test/order-photos/uid-1/SND-1050.jpg' });
  });
});
