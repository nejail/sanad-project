import { buildQuote } from '../src/models/pricing';
import { driverFields, mergeOrders, nextOrderId, orderNumber, sameOrders } from '../src/models/orders';
import { Order } from '../src/models/types';
import { OrdersRepo, encodeOrder } from '../src/services/ordersRepo';
import { orderToDoc } from '../src/models/firestore';
import { FakeFirestore, FakeGeoPoint, FakeTimestamp } from './fakeFirestore';

const T0 = '2026-11-19T10:00:00.000Z';
const T1 = '2026-11-19T10:01:00.000Z';

/** A placed order for the tests (sent to technicians unless the patch says otherwise). */
function order(id: string, patch: Partial<Order> = {}): Order {
  return {
    id, serviceId: 'battery', optionId: 'jump', title: 'Battery Jump Start', carId: 'car-1', carLabel: 'Land Cruiser · 12345',
    address: { id: 'current', label: 'Current location', line: 'CMU-Q car park', coords: { latitude: 25.31, longitude: 51.44 }, isDefault: false },
    schedule: { kind: 'asap' }, quote: buildQuote({ serviceId: 'battery', optionId: 'jump' }), payment: 'cash',
    status: 'confirmed', statusHistory: [{ status: 'confirmed', at: T0 }], createdAt: T0,
    provider: { name: 'Waiting for a technician', rating: 0, vehicle: '', phone: '', base: { id: 'g1', name: 'Al Sadd Auto', coords: { latitude: 25.28, longitude: 51.5 } }, etaMin: 9 },
    dispatch: 'provider', customerName: 'Hassan', customerPhone: '50123456',
    ...patch,
  };
}

describe('order ids (V2 feature 5)', () => {
  it('reads the running number with or without the driver tag', () => {
    expect(orderNumber('SND-1043')).toBe(1043);
    expect(orderNumber('SND-1043-K7QF')).toBe(1043);
    expect(orderNumber('something else')).toBe(0);
  });
  it('counts up from the highest order, and tags ids in the development build', () => {
    expect(nextOrderId([])).toBe('SND-1043');
    expect(nextOrderId([{ id: 'SND-1050' }, { id: 'SND-1044' }])).toBe('SND-1051');
    expect(nextOrderId([{ id: 'SND-1050-AB12' }], 'k7qf9XyZ')).toBe('SND-1051-K7QF');
    expect(nextOrderId([], 'local:50123456')).toBe('SND-1043-LOCA');
  });
});

describe('driver fields', () => {
  it('drops the fields only a technician may write', () => {
    expect(driverFields({ status: 'cancelled', providerId: 'x', provider: {}, acceptedAt: 'y', photoUrl: 'u', notes: undefined }))
      .toEqual({ status: 'cancelled', photoUrl: 'u' });
  });
});

describe('merging Firestore orders into the phone', () => {
  it('follows the technician for orders sent to providers, keeping the garage and local photo', () => {
    const local = order('SND-1', { photoUri: 'file:///car.jpg' });
    const remote = order('SND-1', {
      status: 'accepted', statusHistory: [{ status: 'confirmed', at: T0 }, { status: 'accepted', at: T1 }], acceptedAt: T1,
      provider: { id: 'prov-1', name: 'Ahmed', rating: 4.9, vehicle: 'Van', phone: '+97455550123', verified: true },
    });
    const [m] = mergeOrders([local], [remote]);
    expect(m.status).toBe('accepted');
    expect(m.provider.name).toBe('Ahmed');
    expect(m.provider.base?.name).toBe('Al Sadd Auto');
    expect(m.provider.etaMin).toBe(9);
    expect(m.photoUri).toBe('file:///car.jpg');
  });
  it('keeps the phone copy of a simulated order', () => {
    const local = order('SND-1', { dispatch: 'simulated', status: 'on_the_way', provider: { name: 'Ahmed (simulated)', rating: 4.9, vehicle: 'Van', phone: '' } });
    const remote = order('SND-1', { dispatch: 'simulated' });
    expect(mergeOrders([local], [remote])[0]).toBe(local);
  });
  it('keeps the phone copy when it is further along (Provider Mode tested on one phone)', () => {
    const local = order('SND-1', { status: 'accepted', statusHistory: [{ status: 'confirmed', at: T0 }, { status: 'accepted', at: T1 }] });
    expect(mergeOrders([local], [order('SND-1')])[0].status).toBe('accepted');
  });
  it('adds orders placed on another phone and keeps older phone-only orders, newest first', () => {
    const old = order('SND-1042', { createdAt: '2026-11-01T10:00:00.000Z', dispatch: 'simulated' });
    const other = order('SND-1044-AB12', { createdAt: '2026-11-19T11:00:00.000Z' });
    expect(mergeOrders([old], [other]).map((o) => o.id)).toEqual(['SND-1044-AB12', 'SND-1042']);
  });
  it('tells when nothing changed', () => {
    expect(sameOrders([order('A')], [order('A')])).toBe(true);
    expect(sameOrders([order('A')], [order('A', { status: 'done' })])).toBe(false);
  });
});

describe('OrdersRepo', () => {
  it('creates the order with Firestore types and no technician', async () => {
    const db = new FakeFirestore();
    await new OrdersRepo(db).create(order('SND-1043-K7QF', { offeredTo: 'prov-1', offeredAt: T0 }), 'uid-driver');
    const doc = db.docs.get('orders/SND-1043-K7QF')!;
    expect(doc.customerId).toBe('uid-driver');
    expect(doc.providerId).toBeNull();
    expect(doc.dispatch).toBe('provider');
    expect(doc.offeredTo).toBe('prov-1');
    expect(doc.offeredAt).toBeInstanceOf(FakeTimestamp);
    expect((doc.address as { location: unknown }).location).toBeInstanceOf(FakeGeoPoint);
    expect(doc.createdAt).toBeInstanceOf(FakeTimestamp);
    expect((doc.statusHistory as { at: unknown }[])[0].at).toBeInstanceOf(FakeTimestamp);
  });

  it('updates only the allowed fields and keeps the technician\'s', async () => {
    const db = new FakeFirestore();
    const repo = new OrdersRepo(db);
    await repo.create(order('SND-1'), 'uid-driver');
    db.externalSet('orders/SND-1', { ...db.docs.get('orders/SND-1')!, providerId: 'prov-1', status: 'accepted' });
    await repo.update('SND-1', { photoPath: 'order-photos/u/SND-1.jpg', photoUrl: 'https://x/1.jpg', provider: null } as never, T1);
    const ops = db.commits[db.commits.length - 1];
    expect(ops[0].kind).toBe('update');
    expect(Object.keys((ops[0] as { data: object }).data).sort()).toEqual(['photoPath', 'photoUrl', 'updatedAt']);
    const doc = db.docs.get('orders/SND-1')!;
    expect(doc.providerId).toBe('prov-1');
    expect(doc.photoUrl).toBe('https://x/1.jpg');
  });

  it('stores a status change with its history as Timestamps', async () => {
    const db = new FakeFirestore();
    const repo = new OrdersRepo(db);
    await repo.create(order('SND-1', { dispatch: 'simulated' }), 'uid-driver');
    await repo.update('SND-1', { status: 'on_the_way', statusHistory: [{ status: 'confirmed', at: T0 }, { status: 'on_the_way', at: T1 }] }, T1);
    const doc = db.docs.get('orders/SND-1')!;
    expect(doc.status).toBe('on_the_way');
    expect((doc.statusHistory as { at: unknown }[])[1].at).toBeInstanceOf(FakeTimestamp);
  });

  it('listens to this driver\'s orders only, and follows a technician live', async () => {
    const db = new FakeFirestore();
    const repo = new OrdersRepo(db);
    const seen: Order[][] = [];
    const stop = repo.listenMine('uid-driver', (o) => seen.push(o), () => undefined);
    await repo.create(order('SND-1'), 'uid-driver');
    await repo.create(order('SND-2'), 'someone-else');
    expect(seen[seen.length - 1].map((o) => o.id)).toEqual(['SND-1']);
    db.externalSet('orders/SND-1', { ...db.docs.get('orders/SND-1')!, providerId: 'prov-1', status: 'accepted', provider: { name: 'Ahmed', phone: '+97455550123', vehicle: 'Van', vehiclePlate: null, rating: 4.9, verified: true } });
    const last = seen[seen.length - 1][0];
    expect(last.status).toBe('accepted');
    expect(last.provider.name).toBe('Ahmed');
    expect(last.createdAt).toBe(T0);
    stop();
    expect(db.listenerCount).toBe(0);
  });

  it('encodes a tow destination as a GeoPoint', () => {
    const db = new FakeFirestore();
    const tow = order('SND-1', { serviceId: 'emergency', towTo: { id: 'g', name: 'Garage', coords: { latitude: 25.2, longitude: 51.5 }, distanceKm: 6 } });
    const data = encodeOrder(db, orderToDoc(tow, 'u'));
    expect((data.towTo as { location: unknown }).location).toBeInstanceOf(FakeGeoPoint);
  });
});
