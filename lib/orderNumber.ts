import type Stripe from "stripe";
import { STRIPE_ORDER_NUMBER_METADATA_KEY } from "@/lib/adminJobStatus";

/** Human-readable order number for custom-designer Stripe checkouts (e.g. CD-20250523-A7K2). */
export function generateStripeOrderNumber(createdAt: Date = new Date()): string {
  const y = createdAt.getUTCFullYear();
  const m = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(createdAt.getUTCDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CD-${y}${m}${d}-${suffix}`;
}

export function stripeOrderNumberFromPaymentIntent(
  paymentIntent: Pick<Stripe.PaymentIntent, "id" | "created" | "metadata">
): string {
  const fromMeta = paymentIntent.metadata?.[STRIPE_ORDER_NUMBER_METADATA_KEY]?.trim();
  if (fromMeta) {
    return fromMeta;
  }

  const created = new Date(paymentIntent.created * 1000);
  const y = created.getUTCFullYear();
  const m = String(created.getUTCMonth() + 1).padStart(2, "0");
  const d = String(created.getUTCDate()).padStart(2, "0");
  const suffix = paymentIntent.id.replace(/^pi_/, "").slice(-6).toUpperCase();
  return `CD-${y}${m}${d}-${suffix}`;
}
