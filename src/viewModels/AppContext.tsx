import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { orderTitle } from '../models/catalog';
import { buildQuote, isFirstWashFree } from '../models/pricing';
import { DEMO_ADDRESSES, DEMO_CARS, DEMO_ORDERS, DEMO_PHONE, DEMO_USER } from '../models/seed';
import { Address, BookingDraft, Car, Order, OrderStatus, ServiceId } from '../models/types';
import { clearSession, createSession, readSession } from '../services/session';
import { AccountData, loadAccount, saveAccount } from '../services/storage';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface State {
  status: AuthStatus;
  account: AccountData | null;
  draft: BookingDraft;
}

const emptyDraft: BookingDraft = { addOnIds: [], payment: 'cash' };

type Action =
  | { type: 'signedOut' }
  | { type: 'signedIn'; account: AccountData }
  | { type: 'account'; update: (a: AccountData) => AccountData }
  | { type: 'draft'; patch: Partial<BookingDraft> }
  | { type: 'resetDraft'; serviceId?: ServiceId };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'signedOut':
      return { status: 'signedOut', account: null, draft: emptyDraft };
    case 'signedIn':
      return { status: 'signedIn', account: action.account, draft: emptyDraft };
    case 'account':
      return state.account ? { ...state, account: action.update(state.account) } : state;
    case 'draft':
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case 'resetDraft':
      return { ...state, draft: { ...emptyDraft, serviceId: action.serviceId } };
  }
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/** Returns the stored account for a phone number, creating the demo account on first use. */
async function findAccount(phone: string): Promise<AccountData | null> {
  const stored = await loadAccount(phone);
  if (stored) return stored;
  if (phone === DEMO_PHONE) {
    const seeded = { user: DEMO_USER, cars: DEMO_CARS, addresses: DEMO_ADDRESSES, orders: DEMO_ORDERS };
    await saveAccount(seeded);
    return seeded;
  }
  return null;
}

function useAppModel() {
  const [state, dispatch] = useReducer(reducer, { status: 'loading', account: null, draft: emptyDraft });
  const hydrated = useRef(false);

  // Restore an existing session (used by the splash screen to decide where to go).
  const restoreSession = useCallback(async (): Promise<'signedIn' | 'signedOut'> => {
    const session = await readSession();
    const account = session ? await findAccount(session.phone) : null;
    if (account) {
      dispatch({ type: 'signedIn', account });
      return 'signedIn';
    }
    dispatch({ type: 'signedOut' });
    return 'signedOut';
  }, []);

  // Persist account changes after the first load.
  useEffect(() => {
    if (!state.account) return;
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    saveAccount(state.account).catch(() => undefined);
  }, [state.account]);

  const accountExists = useCallback(async (phone: string) => (await findAccount(phone)) !== null, []);

  /** Called after a successful OTP check for an existing user. */
  const signIn = useCallback(async (phone: string) => {
    const account = await findAccount(phone);
    if (!account) throw new Error('No account for this number');
    await createSession(phone);
    hydrated.current = false;
    dispatch({ type: 'signedIn', account });
    return account;
  }, []);

  /** Called after a successful OTP check for a new user. New users start with no cars. */
  const register = useCallback(async (phone: string, name: string) => {
    const account: AccountData = {
      user: { phone, name: name.trim(), createdAt: new Date().toISOString() },
      cars: [],
      addresses: [],
      orders: [],
    };
    await saveAccount(account);
    await createSession(phone);
    hydrated.current = false;
    dispatch({ type: 'signedIn', account });
    return account;
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    dispatch({ type: 'signedOut' });
  }, []);

  const addCar = useCallback((car: Omit<Car, 'id' | 'isDefault'> & { isDefault?: boolean }) => {
    const id = uid('car');
    dispatch({
      type: 'account',
      update: (a) => {
        const makeDefault = car.isDefault || a.cars.length === 0;
        const cars = a.cars.map((c) => (makeDefault ? { ...c, isDefault: false } : c));
        return { ...a, cars: [...cars, { ...car, id, isDefault: makeDefault }] };
      },
    });
    return id;
  }, []);

  const removeCar = useCallback((id: string) => {
    dispatch({
      type: 'account',
      update: (a) => {
        const cars = a.cars.filter((c) => c.id !== id);
        if (cars.length && !cars.some((c) => c.isDefault)) cars[0] = { ...cars[0], isDefault: true };
        return { ...a, cars };
      },
    });
  }, []);

  const addAddress = useCallback((addr: Omit<Address, 'id'>) => {
    const id = uid('addr');
    dispatch({
      type: 'account',
      update: (a) => {
        const makeDefault = addr.isDefault || a.addresses.length === 0;
        const addresses = a.addresses.map((x) => (makeDefault ? { ...x, isDefault: false } : x));
        return { ...a, addresses: [...addresses, { ...addr, id, isDefault: makeDefault }] };
      },
    });
    return id;
  }, []);

  const updateDraft = useCallback((patch: Partial<BookingDraft>) => dispatch({ type: 'draft', patch }), []);
  const startBooking = useCallback((serviceId: ServiceId) => dispatch({ type: 'resetDraft', serviceId }), []);

  const placeOrder = useCallback((): Order => {
    const a = state.account;
    const d = state.draft;
    if (!a || !d.serviceId || !d.optionId || !d.carId || !d.address) throw new Error('Booking is incomplete');
    const car = a.cars.find((c) => c.id === d.carId);
    const promoApplied = d.serviceId === 'carwash' && isFirstWashFree(a.orders);
    const order: Order = {
      id: `SND-${Math.max(1042, ...a.orders.map((o) => Number(o.id.replace('SND-', '')) || 0)) + 1}`,
      serviceId: d.serviceId,
      optionId: d.optionId,
      title: orderTitle(d.serviceId, d.optionId),
      carId: d.carId,
      carLabel: car ? `${car.model} · ${car.plate}` : 'Car',
      address: d.address,
      schedule: d.schedule ?? { kind: 'asap' },
      quote: buildQuote({ serviceId: d.serviceId, optionId: d.optionId, addOnIds: d.addOnIds, litres: d.litres, distanceKm: d.distanceKm, firstWashFree: promoApplied }),
      promoApplied,
      payment: d.payment,
      notes: d.notes,
      photoUri: d.photoUri,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      provider: { name: 'Ahmed Al-Mansouri', rating: 4.9, vehicle: 'Toyota Camry', phone: '+97455550123' },
    };
    dispatch({ type: 'account', update: (acc) => ({ ...acc, orders: [order, ...acc.orders] }) });
    return order;
  }, [state.account, state.draft]);

  const setOrderStatus = useCallback((id: string, status: OrderStatus) => {
    dispatch({
      type: 'account',
      update: (a) => ({ ...a, orders: a.orders.map((o) => (o.id === id ? { ...o, status } : o)) }),
    });
  }, []);

  return useMemo(
    () => ({
      ...state,
      restoreSession,
      accountExists,
      signIn,
      register,
      signOut,
      addCar,
      removeCar,
      addAddress,
      updateDraft,
      startBooking,
      placeOrder,
      setOrderStatus,
    }),
    [state, restoreSession, accountExists, signIn, register, signOut, addCar, removeCar, addAddress, updateDraft, startBooking, placeOrder, setOrderStatus],
  );
}

export type AppModel = ReturnType<typeof useAppModel>;
const AppContext = createContext<AppModel | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const model = useAppModel();
  return <AppContext.Provider value={model}>{children}</AppContext.Provider>;
}

export function useApp(): AppModel {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

const SIGNED_OUT: AccountData = { user: { phone: '', name: '', createdAt: '' }, cars: [], addresses: [], orders: [] };

/** Convenience hook for screens that only render when signed in (empty data while signing out). */
export function useAccount(): AccountData {
  const { account } = useApp();
  return account ?? SIGNED_OUT;
}
