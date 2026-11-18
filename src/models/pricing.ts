import { FUEL_DELIVERY_FEE, TOWING_PER_KM, VAT_RATE, getOption, getService } from './catalog';
import { Coordinates, Quote, QuoteLine, ServiceId } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface QuoteInput {
  serviceId: ServiceId;
  optionId: string;
  addOnIds?: string[];
  litres?: number;
  distanceKm?: number;
  /** Launch Special: the car wash package is free on the customer's first promo order (add-ons still charged). */
  firstWashFree?: boolean;
}

export const LAUNCH_SPECIAL_LABEL = 'Launch Special: first car wash free';

/** Orders before the launch special never used it, so only orders marked promoApplied count. */
export function isFirstWashFree(orders: { promoApplied?: boolean; status: string }[]): boolean {
  return !orders.some((o) => o.promoApplied && o.status !== 'cancelled');
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
        lines.push({ label: 'Towing base fee', amount: option.price });
        // The distance comes from the nearest garage, found automatically on the review screen.
        // Until then only the base fee is shown, marked as an estimate.
        if (input.distanceKm != null) {
          const km = Math.max(0, input.distanceKm);
          lines.push({ label: `Distance to garage (${km.toFixed(1)} km × ${TOWING_PER_KM} QAR)`, amount: round2(km * TOWING_PER_KM) });
        }
        isEstimate = true;
      } else {
        lines.push({ label: option.title, amount: option.price });
      }
      break;
    }
    default: {
      lines.push({ label: option.title, amount: option.price });
      if (option.priceLabel.endsWith('+')) isEstimate = true;
      if (input.serviceId === 'carwash' && input.firstWashFree) {
        lines.push({ label: LAUNCH_SPECIAL_LABEL, amount: -option.price });
      }
      for (const id of input.addOnIds ?? []) {
        const addOn = service.addOns?.find((a) => a.id === id);
        if (addOn) lines.push({ label: addOn.title, amount: addOn.price });
      }
    }
  }

  const subtotal = Math.max(0, round2(lines.reduce((sum, l) => sum + l.amount, 0)));
  const vat = round2(subtotal * VAT_RATE);
  return { lines, subtotal, vat, total: round2(subtotal + vat), isEstimate };
}

export const formatQAR = (n: number) => `${n.toFixed(2)} QAR`;

/**
 * Plain-language explanation of a tow price, shown above the price on the first price screen
 * (Sprint 5: 4 of 10 drivers read the 200 QAR base fee as the final price).
 * Without a distance yet, it explains the formula with a worked example.
 */
export function towPriceExplanation(baseFee: number, km?: number, garageName?: string): string {
  if (km == null) {
    const example = 10;
    return `Towing costs ${baseFee} QAR plus ${TOWING_PER_KM} QAR for every km to the garage. For example, ${example} km costs ${baseFee + example * TOWING_PER_KM} QAR before VAT.`;
  }
  const distance = round2(Math.max(0, km) * TOWING_PER_KM);
  const to = garageName ? ` to ${garageName}` : ' to the nearest garage';
  return `${baseFee} QAR base fee + ${distance.toFixed(0)} QAR for ${km.toFixed(1)} km${to} = ${(baseFee + distance).toFixed(0)} QAR before VAT.`;
}

/** Short price for the towing option row, e.g. "≈ 246 QAR" once the distance is known. */
export function towOptionLabel(quote: Quote, hasDistance: boolean, fallback: string): string {
  return hasDistance ? `≈ ${Math.round(quote.total)} QAR` : fallback;
}

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
