import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { orderTitle } from '../models/catalog';
import { buildQuote, isFirstWashFree } from '../models/pricing';
import { DEMO_ADDRESSES, DEMO_CARS, DEMO_ORDERS, DEMO_PHONE, DEMO_USER } from '../models/seed';
import { Address, BookingDraft, Car, Order, OrderStatus, ServiceId } from '../models/types';
import { getPhoneAuth } from '../services/auth';
import { CatalogSource, loadCatalog } from '../services/catalogRepo';
import { FirestoreRepo, RemoteAccount, firestoreMessage, getFirestoreApi, sameRemote } from '../services/firestoreRepo';
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
  | { type: 'remote'; remote: RemoteAccount }
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
    case 'remote': {
      // Firestore sent a newer profile, cars or addresses (for example edited on another phone).
      const a = state.account;
      if (!a || sameRemote(a, action.remote)) return state;
      // Keep screen-only details Firestore does not store, such as "last service 5 days ago".
      const cars = action.remote.cars.map((c) => ({ ...c, lastService: a.cars.find((x) => x.id === c.id)?.lastService }));
      return { ...state, account: { ...a, user: action.remote.user, cars, addresses: action.remote.addresses } };
    }
    case 'draft':
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case 'resetDraft':
      return { ...state, draft: { ...emptyDraft, serviceId: action.serviceId } };
  }
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/** Firebase user ids look like "Xy12..."; prototype sessions use "local:<phone>" and never touch Firestore. */
const isFirebaseUid = (id: string | null | undefined): id is string => !!id && !id.startsWith('local:');

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
  // Signed-in user id: the Firebase uid in the development build, "local:<phone>" in Expo Go.
  // Firestore documents are keyed by this id (users/{uid}).
  const [authUid, setAuthUid] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);
  // Firestore repository in the development build; null in Expo Go, web and tests (AsyncStorage only).
  const repo = useMemo(() => (getPhoneAuth().mode === 'firebase' ? new FirestoreRepo(getFirestoreApi()) : null), []);
  // What Firestore holds right now, so only real changes are written.
  const remoteRef = useRef<RemoteAccount | null>(null);
  // Account loaded by accountExists, reused by signIn right after so Firestore is read once.
  const loadedRef = useRef<{ uid: string; account: AccountData; remote: RemoteAccount } | null>(null);
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('builtin');
  const catalogLoaded = useRef(false);
  // Short message shown when saving to Firestore fails (see SyncToast).
  const [syncError, setSyncError] = useState<string | null>(null);

  /**
   * Loads the account for a signed-in user.
   * Firebase mode: profile, cars and addresses from users/{uid}; orders from the phone (Firestore in Sprint 5).
   * If there is no profile yet but the phone already has this number's data (an earlier prototype build,
   * or the demo account), it is uploaded once so nothing is lost.
   * Local mode: the Sprint 3 AsyncStorage account, unchanged.
   */
  const loadAccountFor = useCallback(async (phone: string, userId: string | null): Promise<AccountData | null> => {
    if (!repo || !isFirebaseUid(userId)) return findAccount(phone);
    if (loadedRef.current?.uid === userId) return loadedRef.current.account;
    const local = await loadAccount(phone);
    let remote: RemoteAccount | null;
    try {
      remote = await repo.loadAccount(userId);
    } catch (e) {
      // Offline with nothing in the Firestore cache: use the copy kept on the phone, if any.
      if (local) return local;
      throw new Error(firestoreMessage(e));
    }
    let orders = local?.orders ?? [];
    if (!remote) {
      const existing = await findAccount(phone);
      if (!existing) return null; // new user: Register > Add Your First Car
      try {
        await repo.createUser(userId, existing.user, existing.cars, existing.addresses, existing.orders);
      } catch (e) {
        throw new Error(firestoreMessage(e));
      }
      remote = { user: existing.user, cars: existing.cars, addresses: existing.addresses };
      orders = existing.orders;
    }
    const account: AccountData = { ...remote, orders };
    loadedRef.current = { uid: userId, account, remote };
    return account;
  }, [repo]);

  /** Reads the service catalogue from Firestore once per launch (built-in prices otherwise). */
  const ensureCatalog = useCallback(async () => {
    if (catalogLoaded.current) return;
    const result = await loadCatalog(repo ? getFirestoreApi() : null);
    if (result.source === 'firestore') catalogLoaded.current = true; // otherwise try again at the next sign-in
    setCatalogSource(result.source);
  }, [repo]);

  /** Opens the app for a loaded account: remembers the user id and what Firestore holds, then shows Home. */
  const enter = useCallback((account: AccountData, userId: string) => {
    const cached = loadedRef.current?.uid === userId ? loadedRef.current.remote : null;
    remoteRef.current = isFirebaseUid(userId) ? cached ?? { user: account.user, cars: account.cars, addresses: account.addresses } : null;
    loadedRef.current = null;
    uidRef.current = userId;
    setAuthUid(userId);
    hydrated.current = false;
    // Keep a copy on the phone so the app still opens offline.
    if (isFirebaseUid(userId)) saveAccount(account).catch(() => undefined);
    dispatch({ type: 'signedIn', account });
  }, []);

  /**
   * Restore an existing session (used by the splash screen to decide where to go).
   * In Firebase mode the Firebase user is the source of truth; otherwise the secure-store session.
   */
  const restoreSession = useCallback(async (): Promise<'signedIn' | 'signedOut'> => {
    const auth = getPhoneAuth();
    let phone: string | null = null;
    let userId: string | null = null;
    if (auth.mode === 'firebase') {
      const user = auth.currentUser();
      if (user?.phone) {
        phone = user.phone;
        userId = user.uid;
      }
    } else {
      const session = await readSession();
      if (session) {
        phone = session.phone;
        userId = `local:${session.phone}`;
      }
    }
    let account: AccountData | null = null;
    try {
      account = phone ? await loadAccountFor(phone, userId) : null;
    } catch {
      // Firestore could not be reached and nothing is saved on the phone: sign in again later.
      dispatch({ type: 'signedOut' });
      return 'signedOut';
    }
    if (account && userId) {
      await ensureCatalog();
      enter(account, userId);
      return 'signedIn';
    }
    await clearSession();
    if (auth.mode === 'firebase' && auth.currentUser()) await auth.signOut();
    dispatch({ type: 'signedOut' });
    return 'signedOut';
  }, [loadAccountFor, ensureCatalog, enter]);

  // Persist account changes after the first load: on the phone always, and to Firestore in the development build.
  useEffect(() => {
    if (!state.account) return;
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    const next = state.account;
    saveAccount(next).catch(() => undefined);
    const userId = uidRef.current;
    if (!repo || !isFirebaseUid(userId)) return;
    const prev = remoteRef.current;
    if (prev && sameRemote(prev, next)) return; // nothing Firestore stores has changed (e.g. a new order)
    remoteRef.current = { user: next.user, cars: next.cars, addresses: next.addresses };
    // Offline, Firestore keeps the write and sends it later; this only fails for real errors.
    repo.syncChanges(userId, prev, next).catch((e) => {
      remoteRef.current = prev; // the next change retries everything that was not saved
      setSyncError(firestoreMessage(e));
    });
  }, [state.account, repo]);

  // Live updates: cars and addresses added or removed on another device appear here too.
  useEffect(() => {
    if (!repo || !isFirebaseUid(authUid) || state.status !== 'signedIn') return;
    return repo.listenAccount(
      authUid,
      (remote) => {
        if (!remote) return; // profile removed in the console: keep what is on screen
        remoteRef.current = remote;
        dispatch({ type: 'remote', remote });
      },
      (e) => setSyncError(firestoreMessage(e)),
    );
  }, [repo, authUid, state.status]);

  /**
   * True when this number already has an account.
   * Firebase mode: "does users/{uid} exist" for the signed-in user. Before the code is confirmed
   * nobody is signed in and the rules block the read, so it answers false and register() checks
   * again after verification instead of overwriting an existing profile.
   */
  const accountExists = useCallback(async (phone: string) => {
    if (!repo) return (await findAccount(phone)) !== null;
    const user = getPhoneAuth().currentUser();
    if (!user) return false;
    return (await loadAccountFor(phone, user.uid)) !== null;
  }, [repo, loadAccountFor]);

  /** Called after a successful OTP check for an existing user. `userId` comes from the auth provider. */
  const signIn = useCallback(async (phone: string, userId: string = `local:${phone}`) => {
    const account = await loadAccountFor(phone, userId);
    if (!account) throw new Error('No account for this number');
    await createSession(phone);
    await ensureCatalog();
    enter(account, userId);
    return account;
  }, [loadAccountFor, ensureCatalog, enter]);

  /** Called after a successful OTP check for a new user. New users start with no cars. */
  const register = useCallback(async (phone: string, name: string, userId: string = `local:${phone}`) => {
    // Firebase mode: if this number already has a profile, sign in to it instead of overwriting it.
    const existing = repo && isFirebaseUid(userId) ? await loadAccountFor(phone, userId) : null;
    const account: AccountData = existing ?? {
      user: { phone, name: name.trim(), createdAt: new Date().toISOString() },
      cars: [],
      addresses: [],
      orders: [],
    };
    if (!existing) {
      if (repo && isFirebaseUid(userId)) {
        try {
          await repo.createUser(userId, account.user);
        } catch (e) {
          throw new Error(firestoreMessage(e));
        }
      }
      await saveAccount(account);
    }
    await createSession(phone);
    await ensureCatalog();
    enter(account, userId);
    return account;
  }, [repo, loadAccountFor, ensureCatalog, enter]);

  const signOut = useCallback(async () => {
    await getPhoneAuth().signOut().catch(() => undefined);
    await clearSession();
    remoteRef.current = null;
    loadedRef.current = null;
    uidRef.current = null;
    setAuthUid(null);
    setSyncError(null);
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

  const clearSyncError = useCallback(() => setSyncError(null), []);

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
      towTo: d.serviceId === 'emergency' && d.optionId === 'towing' ? d.towTo : undefined,
      provider: {
        name: 'Ahmed Al-Mansouri',
        rating: 4.9,
        vehicle: d.serviceId === 'emergency' ? 'Flatbed tow truck' : 'Toyota Hilux service van',
        phone: d.providerBase?.phone ?? '+97455550123',
        base: d.providerBase ? { id: d.providerBase.id, name: d.providerBase.name, coords: d.providerBase.coords, phone: d.providerBase.phone } : undefined,
        etaMin: d.providerBase?.etaMin,
      },
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
      uid: authUid,
      authMode: getPhoneAuth().mode,
      /** Where the account is saved: Firestore in the development build, the phone otherwise. */
      dataSource: (repo && isFirebaseUid(authUid) ? 'firestore' : 'device') as 'firestore' | 'device',
      catalogSource,
      syncError,
      clearSyncError,
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
    [state, authUid, repo, catalogSource, syncError, clearSyncError, restoreSession, accountExists, signIn, register, signOut, addCar, removeCar, addAddress, updateDraft, startBooking, placeOrder, setOrderStatus],
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
