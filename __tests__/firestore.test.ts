import { COLLECTIONS, addressFromDoc, addressToDoc, carFromDoc, carToDoc, orderToDoc, userFromDoc, userToDoc } from '../src/models/firestore';
import { DEMO_ADDRESSES, DEMO_CARS, DEMO_ORDERS, DEMO_USER } from '../src/models/seed';

describe('Firestore structure', () => {
  it('nests cars and addresses under the user', () => {
    expect(COLLECTIONS.cars('uid1')).toBe('users/uid1/cars');
    expect(COLLECTIONS.tracking('SND-1042')).toBe('orders/SND-1042/tracking');
  });

  it('stores phone numbers in E.164 and maps users both ways', () => {
    const doc = userToDoc(DEMO_USER, DEMO_CARS, DEMO_ADDRESSES, false);
    expect(doc.phone).toBe('+97450123456');
    expect(doc.defaultCarId).toBe('car-1');
    expect(userFromDoc(doc)).toEqual(DEMO_USER);
  });

  it('round-trips cars and addresses without losing data', () => {
    const car = { ...DEMO_CARS[0], lastService: undefined };
    const { lastService, ...expected } = car;
    expect(carFromDoc(car.id, carToDoc(car))).toEqual(expected);
    expect(carToDoc(car).year).toBe(2023);
    expect(addressFromDoc(DEMO_ADDRESSES[1].id, addressToDoc(DEMO_ADDRESSES[1]))).toEqual({ ...DEMO_ADDRESSES[1], landmark: undefined });
  });

  it('turns an order into a document with snapshots, currency and status history', () => {
    const doc = orderToDoc(DEMO_ORDERS[0], 'uid1');
    expect(doc.customerId).toBe('uid1');
    expect(doc.providerId).toBeNull();
    expect(doc.quote.currency).toBe('QAR');
    expect(doc.quote.total).toBe(52.5);
    expect(doc.address.location).toEqual(DEMO_ADDRESSES[0].coords);
    expect(doc.statusHistory[0].status).toBe('on_the_way');
  });
});
