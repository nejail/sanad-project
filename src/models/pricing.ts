import { FUEL_DELIVERY_FEE, TOWING_PER_KM, VAT_RATE, getOption, getService } from './catalog';
import { Coordinates, Quote, QuoteLine, ServiceId } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface QuoteInput {
  serviceId: ServiceId;
  optionId: string;
  addOnIds?: string[];
  litres?: number;
  distanceKm?: number;
}

/**
 * Builds the price breakdown shown on the service and review screens.
 * Mirrors the numbers in the wireframes, e.g. Jump Start 50 + 5% VAT = 52.50 QAR.
 */
export function buildQuote(input: QuoteInput): Quote {
  const service = getService(input.serviceId);
  const option = getOption(input.serviceId, input.optionId);
  const lines: QuoteLine[] = [];
  let isEstimate = false;

  switch (service.pricing) {
    case 'perLitre': {
      const litres = Math.max(1, Math.round(input.litres ?? 40));
      lines.push({ label: `Fuel ${litres} L + delivery`, amount: round2(option.price * litres + FUEL_DELIVERY_FEE) });
      break;
    }
    case 'towing': {
      if (option.id === 'towing') {
        const km = Math.max(0, input.distanceKm ?? 2);
        lines.push({ label: 'Towing base fee', amount: option.price });
        lines.push({ label: `Distance (${km.toFixed(1)} km × ${TOWING_PER_KM} QAR)`, amount: round2(km * TOWING_PER_KM) });
        isEstimate = true;
      } else {
        lines.push({ label: option.title, amount: option.price });
      }
      break;
    }
    default: {
      lines.push({ label: option.title, amount: option.price });
      if (option.priceLabel.endsWith('+')) isEstimate = true;
      for (const id of input.addOnIds ?? []) {
        const addOn = service.addOns?.find((a) => a.id === id);
        if (addOn) lines.push({ label: addOn.title, amount: addOn.price });
      }
    }
  }

  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const vat = round2(subtotal * VAT_RATE);
  return { lines, subtotal, vat, total: round2(subtotal + vat), isEstimate };
}

export const formatQAR = (n: number) => `${n.toFixed(2)} QAR`;

/** Great-circle distance in km (used for towing estimates and provider ETA). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough city-driving ETA: 30 km/h average plus 4 minutes dispatch time. */
export function etaMinutes(km: number): number {
  return Math.max(3, Math.round((km / 30) * 60 + 4));
}
