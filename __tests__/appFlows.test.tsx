/**
 * End-to-end checks of the booking flows, driving the whole app (App.tsx: real navigation, app state,
 * screens and storage) the way a driver would. Only the device and the network are faked: GPS,
 * the map view, notifications and the OpenStreetMap / OSRM servers. Runs in Expo Go mode (local
 * sign-in, data on the phone); the Firestore side is covered by the phone tests in docs/version-2.md.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import nominatimGarages from './fixtures/nominatim-garages.json';
import osrmRoute from './fixtures/osrm-route.json';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  setItemAsync: async (k: string, v: string) => { mockSecure.set(k, v); },
  getItemAsync: async (k: string) => mockSecure.get(k) ?? null,
  deleteItemAsync: async (k: string) => { mockSecure.delete(k); },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: async () => undefined, impactAsync: async () => undefined, selectionAsync: async () => undefined,
  NotificationFeedbackType: { Success: 'success' }, ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: () => undefined,
  setNotificationChannelAsync: async () => undefined,
  getPermissionsAsync: async () => ({ granted: true }),
  requestPermissionsAsync: async () => ({ granted: true }),
  scheduleNotificationAsync: async () => 'id',
  getPresentedNotificationsAsync: async () => [],
  getLastNotificationResponse: () => null,
  getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[test]' }),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

/** The phone's GPS: on (at CMU-Q) or off. */
const mockGps = { on: true, calls: 0 };
const MOCK_CMUQ = { latitude: 25.3155, longitude: 51.439 };
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getForegroundPermissionsAsync: async () => ({ granted: true }),
  requestForegroundPermissionsAsync: async () => ({ granted: true }),
  getCurrentPositionAsync: async () => {
    mockGps.calls += 1;
    if (!mockGps.on) throw new Error('Location services are turned off');
    return { coords: { ...MOCK_CMUQ, accuracy: 10 } };
  },
  reverseGeocodeAsync: async (c: { latitude: number }) => [{ name: c.latitude > 25.31 ? 'Education City' : 'Pinned street', city: 'Al Rayyan' }],
  watchPositionAsync: async () => ({ remove: () => undefined }),
}));

/** The native map: a box the test can tap at a position, like a driver dropping a pin. */
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  class MapView extends React.Component<{ onPress?: (e: unknown) => void; children?: React.ReactNode }> {
    animateToRegion() {}
    fitToCoordinates() {}
    render() {
      const { onPress, children } = this.props;
      return React.createElement(Pressable, { testID: 'map', onPress: () => onPress?.({ nativeEvent: { coordinate: { latitude: 25.2667, longitude: 51.5333 } } }) }, children);
    }
  }
  return { __esModule: true, default: MapView, Marker: () => null, Polyline: () => null };
});

/** OpenStreetMap (place lookup and nearby garages) and OSRM (road distance). */
const SALWA = [{ lat: '25.2236', lon: '51.4280', display_name: 'Salwa Road, Fereej Al Manaseer, Al Rayyan, Qatar' }];
const lookups: string[] = [];
beforeAll(() => {
  global.fetch = jest.fn(async (input: unknown) => {
    const url = String(input);
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (url.includes('nominatim') && url.includes('accept-language')) {
      const q = decodeURIComponent(/q=([^&]*)/.exec(url)![1]);
      lookups.push(q);
      return json(q === 'Salwa Road' ? SALWA : []);
    }
    if (url.includes('nominatim')) return json(nominatimGarages);
    if (url.includes('router.project-osrm.org')) return json(osrmRoute);
    if (url.includes('overpass') || url.includes('maps.mail.ru')) throw new Error('timed out');
    return json({});
  }) as unknown as typeof fetch;
});

import App from '../App';
import { DEMO_PHONE, DEMO_ADDRESSES, DEMO_CARS, DEMO_ORDERS, DEMO_USER } from '../src/models/seed';
import { DOHA } from '../src/models/location';
import { loadAccount, saveAccount } from '../src/services/storage';
import { Order } from '../src/models/types';

/** An order typed before the map lookup existed: saved at the centre of Doha. */
const LEGACY: Order = {
  ...DEMO_ORDERS[2], id: 'SND-1010', title: 'Tire · Flat Fix',
  address: { id: 'described', label: 'Described location', line: 'Near the souq', landmark: 'Near the souq', coords: DOHA, isDefault: false },
};

const alerts: string[] = [];

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSecure.clear();
  lookups.length = 0;
  alerts.length = 0;
  mockGps.on = true;
  mockGps.calls = 0;
  jest.spyOn(Alert, 'alert').mockImplementation((title, message) => { alerts.push(`${title}: ${message}`); });
  // Signed in as the demo driver, with one extra finished order typed before the map lookup.
  await saveAccount({ user: DEMO_USER, cars: DEMO_CARS, addresses: DEMO_ADDRESSES, orders: [...DEMO_ORDERS, LEGACY] });
  mockSecure.set('sanad_session', JSON.stringify({ phone: DEMO_PHONE, token: 't', issuedAt: new Date().toISOString() }));
});

afterEach(() => jest.restoreAllMocks());

const WAIT = { timeout: 8000 };

async function openHome() {
  await render(<App />);
  await screen.findByTestId('greeting', {}, WAIT);
}

/** Service > Select Vehicle > Schedule > Review > Place Order, then returns the saved order. */
async function finishBooking(): Promise<Order> {
  await fireEvent.press(await screen.findByTestId('service-continue', {}, WAIT));
  await fireEvent.press((await screen.findAllByTestId('vehicle-row', {}, WAIT))[0]);
  await fireEvent.press(screen.getByTestId('vehicle-continue'));
  await fireEvent.press(await screen.findByTestId('schedule-continue', {}, WAIT));
  await screen.findByText(/km away/, {}, WAIT); // nearest provider found
  await fireEvent.press(screen.getByTestId('place-order'));
  await screen.findByText('Request Sent!', {}, WAIT);
  const saved = await waitFor(async () => {
    const account = await loadAccount(DEMO_PHONE);
    const placed = account!.orders.find((o) => !DEMO_ORDERS.some((d) => d.id === o.id) && o.id !== LEGACY.id);
    expect(placed).toBeDefined();
    return placed!;
  }, WAIT);
  expect(alerts).toEqual([]);
  return saved;
}

describe('booking flows in the app (Expo Go mode)', () => {
  jest.setTimeout(30000);

  it('normal booking: GPS finds the car and the order is placed there', async () => {
    await openHome();
    await fireEvent.press(screen.getByTestId('service-battery'));
    await waitFor(() => expect(screen.getByTestId('selected-address')).toHaveTextContent('Education City, Al Rayyan'), WAIT);
    expect(screen.getByTestId('location-continue')).toHaveTextContent('Continue');
    await fireEvent.press(screen.getByTestId('location-continue'));

    const order = await finishBooking();
    expect(order).toMatchObject({ serviceId: 'battery', status: 'confirmed', dispatch: 'simulated' });
    expect(order.address.coords).toEqual(MOCK_CMUQ);
    expect(order.provider.verified).toBe(false);

    await fireEvent.press(screen.getByTestId('track-order'));
    await screen.findByTestId('tracking-title', {}, WAIT);
    expect(screen.getByTestId('demo-mode-badge')).toBeTruthy();
  });

  it('GPS off: the typed place is found on the map, checked, and the order is placed there', async () => {
    mockGps.on = false;
    await openHome();
    await fireEvent.press(screen.getByTestId('service-battery'));
    await fireEvent.press(await screen.findByTestId('enter-location-manually', {}, WAIT));
    await fireEvent.changeText(screen.getByTestId('location-manual'), 'Salwa Road exit 12, by the petrol station');
    expect(screen.getByTestId('location-continue')).toHaveTextContent('Find on Map');

    await fireEvent.press(screen.getByTestId('location-continue'));
    await screen.findByText(/We placed the pin at Salwa Road, Fereej Al Manaseer/, {}, WAIT);
    expect(lookups).toEqual(['Salwa Road exit 12, by the petrol station', 'Salwa Road exit 12', 'Salwa Road']);
    expect(screen.getByTestId('location-continue')).toHaveTextContent('Continue');

    await fireEvent.press(screen.getByTestId('location-continue'));
    const order = await finishBooking();
    expect(order.address.coords).toEqual({ latitude: 25.2236, longitude: 51.428 });
    expect(order.address.landmark).toBe('Salwa Road exit 12, by the petrol station');
    expect(order.address.coords).not.toEqual(DOHA);
  });

  it('GPS off and the place is not found: the driver taps the map, and the order uses the pin', async () => {
    mockGps.on = false;
    await openHome();
    await fireEvent.press(screen.getByTestId('service-battery'));
    await fireEvent.press(await screen.findByTestId('enter-location-manually', {}, WAIT));
    await fireEvent.changeText(screen.getByTestId('location-manual'), 'xyzxyz');
    await fireEvent.press(screen.getByTestId('location-continue'));
    await screen.findByText(/We couldn't find that place. Tap the map/, {}, WAIT);
    // Still no position, so it cannot continue with a made-up one.
    expect(screen.getByTestId('location-continue')).toHaveTextContent('Find on Map');

    await fireEvent.press(screen.getByTestId('map'));
    await waitFor(() => expect(screen.getByTestId('location-continue')).toHaveTextContent('Continue'), WAIT);
    await fireEvent.press(screen.getByTestId('location-continue'));
    const order = await finishBooking();
    expect(order.address.coords).toEqual({ latitude: 25.2667, longitude: 51.5333 });
    expect(order.address.landmark).toBe('xyzxyz');
  });

  it('Book again: opens Location with the last address, then books the same service there', async () => {
    await openHome();
    await fireEvent.press(screen.getByText('Orders'));
    await fireEvent.press(await screen.findByText('Completed', {}, WAIT));
    const callsBefore = mockGps.calls;
    await fireEvent.press(await screen.findByTestId('book-again-SND-1017', {}, WAIT));

    // Location first, with the old address selected, so the driver can confirm or change it.
    await waitFor(() => expect(screen.getByTestId('selected-address')).toHaveTextContent('Education City, Al Rayyan'), WAIT);
    expect(mockGps.calls).toBe(callsBefore);
    await fireEvent.press(screen.getByTestId('location-continue'));
    await screen.findByText('Tire Service', {}, WAIT);

    const order = await finishBooking();
    expect(order).toMatchObject({ serviceId: 'tire', optionId: 'flat', status: 'confirmed' });
    expect(order.address.coords).toEqual(DEMO_ADDRESSES[1].coords);
  });

  it('Book again on an order saved at the centre of Doha: the app finds the car again instead', async () => {
    await openHome();
    await fireEvent.press(screen.getByText('Orders'));
    await fireEvent.press(await screen.findByText('Completed', {}, WAIT));
    await fireEvent.press(await screen.findByTestId('book-again-SND-1010', {}, WAIT));

    await waitFor(() => expect(screen.getByTestId('selected-address')).toHaveTextContent('Education City, Al Rayyan'), WAIT);
    expect(mockGps.calls).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('location-continue'));
    const order = await finishBooking();
    expect(order.address.coords).toEqual(MOCK_CMUQ);
  });
});
