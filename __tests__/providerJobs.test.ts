import { orderFromDoc, orderToDoc } from '../src/models/firestore';
import { acceptJob, advanceJob, canProviderMove, myJobs, nextProviderStep, openJobsFor, ProviderProfile } from '../src/models/providerJobs';
import { buildQuote } from '../src/models/pricing';
import { Order } from '../src/models/types';
import { ProviderRepo, decodeOrder, providerMessage } from '../src/services/providerRepo';
import { FakeFirestore, FakeTimestamp } from './fakeFirestore';

const T0 = '2026-11-18T10:00:00.000Z';

function order(id: string, patch: Partial<Order> = {}): Order {
  return {
    id, serviceId: 'battery', optionId: 'jump', title: 'Battery Jump Start', carId: 'car-1', carLabel: 'Land Cruiser · 12345',
    address: { id: 'current', label: 'Current location', line: 'CMU-Q car park', landmark: 'Next to the gate', coords: { latitude: 25.31, longitude: 51.44 }, isDefault: false },
    schedule: { kind: 'asap' }, quote: buildQuote({ serviceId: 'battery', optionId: 'jump' }), payment: 'cash',
    status: 'confirmed', statusHistory: [{ status: 'confirmed', at: T0 }], createdAt: T0,
    provider: { name: 'Waiting for a technician', rating: 0, vehicle: '', phone: '' },
    dispatch: 'provider', customerName: 'Nasser', customerPhone: '50123456',
    ...patch,
  };
}

const ahmed: ProviderProfile = {
  id: 'prov-1', name: 'Ahmed Al-Mansouri', businessName: 'Al Sadd Auto', phone: '+97455550123', vehicle: 'Service van',
  vehiclePlate: '61570', rating: 4.9, services: ['battery', 'tire'], isOnline: true, verified: true,
};

describe('provider job steps (V2 feature 4)', () => {
  it('offers one next step at a time', () => {
    expect(nextProviderStep('accepted')?.next).toBe('on_the_way');
    expect(nextProviderStep('on_the_way')?.next).toBe('arrived');
    expect(nextProviderStep('arrived')?.next).toBe('done');
    expect(nextProviderStep('done')).toBeNull();
    expect(nextProviderStep('confirmed')).toBeNull();
  });

  it('never skips or goes backwards', () => {
    expect(canProviderMove('confirmed', 'accepted')).toBe(true);
    expect(canProviderMove('accepted', 'arrived')).toBe(false);
    expect(canProviderMove('arrived', 'on_the_way')).toBe(false);
    expect(() => advanceJob(order('A', { status: 'accepted' }), 'done', T0)).toThrow();
  });

  it('accepting puts the technician on the order with the time', () => {
    const at = '2026-11-18T10:02:00.000Z';
    const accepted = acceptJob(order('A'), ahmed, at);
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedAt).toBe(at);
    expect(accepted.provider).toMatchObject({ id: 'prov-1', name: 'Ahmed Al-Mansouri', vehiclePlate: '61570', verified: true });
    expect(accepted.statusHistory?.map((h) => h.status)).toEqual(['confirmed', 'accepted']);
    expect(() => acceptJob(accepted, ahmed, at)).toThrow('already been taken');
  });

  it('lists open jobs for the services offered, and the technician\'s own jobs', () => {
    const orders = [
      order('A', { createdAt: '2026-11-18T10:05:00.000Z' }),
      order('B', { serviceId: 'carwash' }),
      order('C'),
      order('D', { status: 'on_the_way', provider: { ...ahmed, id: 'prov-1' } }),
      order('E', { status: 'done', provider: { ...ahmed, id: 'prov-1' } }),
    ];
    expect(openJobsFor(orders, ['battery']).map((o) => o.id)).toEqual(['C', 'A']);
    expect(openJobsFor(orders).map((o) => o.id)).toEqual(['B', 'C', 'A']);
    expect(myJobs(orders, 'prov-1').map((o) => o.id)).toEqual(['D', 'E']);
  });
});

describe('orders in Firestore for the provider side', () => {
  it('round-trips an accepted order with the technician and customer details', () => {
    const accepted = acceptJob(order('SND-1050', { photoUrl: 'https://example.test/car.jpg', customerPushToken: 'ExponentPushToken[abc]' }), ahmed, T0);
    const doc = orderToDoc(accepted, 'uid-driver');
    expect(doc.providerId).toBe('prov-1');
    expect(doc.customerPhone).toBe('+97450123456');
    expect(doc.provider).toEqual({ name: 'Ahmed Al-Mansouri', phone: '+97455550123', vehicle: 'Service van', vehiclePlate: '61570', rating: 4.9, verified: true });
    expect(doc.address.landmark).toBe('Next to the gate');
    const back = orderFromDoc('SND-1050', doc);
    expect(back).toMatchObject({
      status: 'accepted', dispatch: 'provider', customerPhone: '50123456', photoUrl: 'https://example.test/car.jpg',
      customerPushToken: 'ExponentPushToken[abc]', acceptedAt: T0,
    });
    expect(back.provider.name).toBe('Ahmed Al-Mansouri');
    expect(back.address.landmark).toBe('Next to the gate');
  });

  it('an order no one accepted has no provider', () => {
    const doc = orderToDoc(order('SND-1051'), 'uid-driver');
    expect(doc.providerId).toBeNull();
    expect(doc.provider).toBeNull();
    expect(orderFromDoc('SND-1051', doc).provider.name).toBe('Waiting for a technician');
  });
});

describe('ProviderRepo with Firestore', () => {
  function seed(db: FakeFirestore, o: Order) {
    db.externalSet(`orders/${o.id}`, orderToDoc(o, 'uid-driver') as unknown as Record<string, unknown>);
  }

  it('loads a provider profile, or null for a driver', async () => {
    const db = new FakeFirestore();
    db.externalSet('providers/prov-1', { name: 'Ahmed', businessName: 'Al Sadd Auto', phone: '+97455550123', vehicle: 'Van', rating: 4.8, services: ['battery'], isOnline: true });
    const repo = new ProviderRepo(db);
    expect(await repo.loadProfile('prov-1')).toMatchObject({ id: 'prov-1', name: 'Ahmed', services: ['battery'], verified: true });
    expect(await repo.loadProfile('uid-driver')).toBeNull();
  });

  it('shows open provider orders live, leaving out simulated ones', () => {
    const db = new FakeFirestore();
    const repo = new ProviderRepo(db);
    const seen: string[][] = [];
    const stop = repo.listenOpenJobs((orders) => seen.push(orders.map((o) => o.id)), () => undefined);
    seed(db, order('SND-1'));
    seed(db, order('SND-2', { dispatch: 'simulated' }));
    expect(seen[seen.length - 1]).toEqual(['SND-1']);
    stop();
    expect(db.listenerCount).toBe(0);
  });

  it('accepts, then moves the job along, keeping the history in Firestore', async () => {
    const db = new FakeFirestore();
    const repo = new ProviderRepo(db);
    seed(db, order('SND-1'));
    const accepted = await repo.accept(order('SND-1'), ahmed, '2026-11-18T10:01:00.000Z');
    let doc = db.docs.get('orders/SND-1')!;
    expect(doc.providerId).toBe('prov-1');
    expect(doc.status).toBe('accepted');
    expect(doc.acceptedAt).toBeInstanceOf(FakeTimestamp);
    expect(doc.customerId).toBe('uid-driver'); // update keeps the other fields

    const mine: string[][] = [];
    repo.listenMyJobs('prov-1', (orders) => mine.push(orders.map((o) => `${o.id}:${o.status}`)), () => undefined);
    await repo.advance(accepted, 'on_the_way', '2026-11-18T10:03:00.000Z');
    doc = db.docs.get('orders/SND-1')!;
    expect(doc.status).toBe('on_the_way');
    expect((doc.statusHistory as unknown[]).length).toBe(3);
    expect(mine[mine.length - 1]).toEqual(['SND-1:on_the_way']);

    const decoded = decodeOrder('SND-1', doc);
    expect(decoded.statusHistory?.map((h) => h.status)).toEqual(['confirmed', 'accepted', 'on_the_way']);
    expect(decoded.statusHistory?.[2].at).toBe('2026-11-18T10:03:00.000Z');
    expect(decoded.provider.name).toBe('Ahmed Al-Mansouri');
  });

  it('reports a job taken by someone else in plain words', async () => {
    const db = new FakeFirestore();
    const repo = new ProviderRepo(db);
    seed(db, order('SND-1'));
    db.failNext = 'permission-denied';
    await expect(repo.accept(order('SND-1'), ahmed)).rejects.toMatchObject({ code: 'firestore/permission-denied' });
    expect(providerMessage({ code: 'firestore/permission-denied' })).toMatch(/taken by another technician/);
  });
});
