export const SETUP_FEE = 35;
export const MIN_QUANTITY = 12;

/** Quantity tiers: [min quantity, price per unit]. Descending by min qty. */
export const QUANTITY_TIERS: [number, number][] = [
  [144, 14],
  [96, 15],
  [48, 16],
  [24, 18],
  [12, 20],
];

export function getUnitPriceForQuantity(qty: number): number {
  const tier = QUANTITY_TIERS.find(([min]) => qty >= min);
  return tier ? tier[1] : QUANTITY_TIERS[QUANTITY_TIERS.length - 1]![1];
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
  locations: number
): { subtotal: number; total: number; unitPrice: number } {
  const unitPrice = getUnitPriceForQuantity(qty);
  const locationMultiplier = locations >= 2 ? 2 : 1;
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
