import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * The signed-in session is kept in the device keychain (iOS) / keystore (Android)
 * through expo-secure-store. The browser has no secure store, so the web preview
 * falls back to localStorage; that fallback is for demos only.
 */
const SESSION_KEY = 'sanad_session';

export interface Session {
  phone: string;
  token: string;
  issuedAt: string;
}

const web = Platform.OS === 'web';

async function setItem(k: string, v: string) {
  if (web) globalThis.localStorage?.setItem(k, v);
  else await SecureStore.setItemAsync(k, v);
}
async function getItem(k: string) {
  if (web) return globalThis.localStorage?.getItem(k) ?? null;
  return SecureStore.getItemAsync(k);
}
async function deleteItem(k: string) {
  if (web) globalThis.localStorage?.removeItem(k);
  else await SecureStore.deleteItemAsync(k);
}

function randomToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createSession(phone: string): Promise<Session> {
  const session = { phone, token: randomToken(), issuedAt: new Date().toISOString() };
  await setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function readSession(): Promise<Session | null> {
  try {
    const raw = await getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await deleteItem(SESSION_KEY);
}

export async function secureStoreRoundTrip(): Promise<string> {
  if (web) throw new Error('Secure store is not available in the browser preview; run on a phone or simulator.');
  const k = 'sanad_selftest';
  const v = randomToken();
  await SecureStore.setItemAsync(k, v);
  const back = await SecureStore.getItemAsync(k);
  await SecureStore.deleteItemAsync(k);
  if (back !== v) throw new Error('Value read back did not match');
  return 'Stored, read back and deleted a token in the keychain/keystore';
}
