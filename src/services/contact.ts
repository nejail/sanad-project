import { Linking } from 'react-native';

export const QATAR_EMERGENCY = '999';

export async function callNumber(phone: string): Promise<boolean> {
  const url = `tel:${phone}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function openWhatsApp(phone: string, message: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, '');
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function canDial(): Promise<boolean> {
  try {
    return await Linking.canOpenURL('tel:999');
  } catch {
    return false;
  }
}
