import type { DecorationType } from "@/lib/decoration";

export const SETUP_FEE = 35;
export const MIN_QUANTITY = 12;

/** Embroidery: quantity tiers [min quantity, price per unit]. Descending by min qty. */
export const EMBROIDERY_QUANTITY_TIERS: [number, number][] = [
  [144, 14],
  [96, 15],
  [48, 16],
  [24, 18],
  [12, 20],
];

/** Leatherette patch: quantity tiers [min quantity, price per unit]. Descending by min qty. */
export const LEATHERETTE_QUANTITY_TIERS: [number, number][] = [
  [144, 15],
  [96, 17],
  [48, 18],
  [24, 20],
  [12, 22],
];

export function getUnitPriceForQuantity(
  qty: number,
  kind: DecorationType = "embroidery"
): number {
  const tiers =
    kind === "leather" ? LEATHERETTE_QUANTITY_TIERS : EMBROIDERY_QUANTITY_TIERS;
  const tier = tiers.find(([min]) => qty >= min);
  return tier ? tier[1] : tiers[tiers.length - 1]![1];
}

/** Matches OrderForm quantity parsing. */
export function parseOrderQuantity(quantity: string | number): number {
  if (
    quantity === "" ||
    quantity === null ||
    Number(quantity) === 0 ||
    Number.isNaN(Number(quantity))
  ) {
    return MIN_QUANTITY;
  }
  return Math.max(MIN_QUANTITY, Math.floor(Number(quantity)));
}

export function computeOrderTotal(
  qty: number,
  locations: number,
  decorationType: DecorationType = "embroidery"
): { subtotal: number; total: number; unitPrice: number } {
  const unitPrice = getUnitPriceForQuantity(qty, decorationType);
  const locationMultiplier =
    decorationType === "leather" ? 1 : locations >= 2 ? 2 : 1;
  const subtotal = unitPrice * qty * locationMultiplier;
  const total = subtotal + SETUP_FEE;
  return { subtotal, total, unitPrice };
}

/** Stripe amount in smallest currency unit (e.g. cents for USD). */
export function toStripeAmount(totalMajor: number, currency: string): number {
  const c = currency.toUpperCase();
  const zeroDecimal = new Set([
    "BIF",
    "CLP",
    "DJF",
    "GNF",
    "JPY",
    "KMF",
    "KRW",
    "MGA",
    "PYG",
    "RWF",
    "UGX",
    "VND",
    "VUV",
    "XAF",
    "XOF",
    "XPF",
  ]);
  if (zeroDecimal.has(c)) return Math.round(totalMajor);
  return Math.round(totalMajor * 100);
}
