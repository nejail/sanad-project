import AsyncStorage from '@react-native-async-storage/async-storage';
import { Address, Car, Order, User } from '../models/types';

/** Everything SANAD keeps on the device for one account. */
export interface AccountData {
  user: User;
  cars: Car[];
  addresses: Address[];
  orders: Order[];
}

const key = (phone: string) => `sanad:account:${phone}`;

export async function loadAccount(phone: string): Promise<AccountData | null> {
  const raw = await AsyncStorage.getItem(key(phone));
  return raw ? (JSON.parse(raw) as AccountData) : null;
}

export async function saveAccount(data: AccountData): Promise<void> {
  await AsyncStorage.setItem(key(data.user.phone), JSON.stringify(data));
}

export async function deleteAccount(phone: string): Promise<void> {
  await AsyncStorage.removeItem(key(phone));
}

/** Round trip used by the feasibility tests screen. */
export async function storageRoundTrip(): Promise<string> {
  const k = 'sanad:selftest';
  const value = { at: Date.now(), cars: 2 };
  await AsyncStorage.setItem(k, JSON.stringify(value));
  const back = JSON.parse((await AsyncStorage.getItem(k)) ?? 'null');
  await AsyncStorage.removeItem(k);
  if (!back || back.at !== value.at) throw new Error('Value read back did not match');
  return 'Wrote, read back and deleted a JSON record';
}
