import Stripe from "stripe";
import {
  computeOrderTotal,
  MIN_QUANTITY,
  parseOrderQuantity,
  toStripeAmount,
} from "@/lib/pricing";

export async function assertPaidOrderMatchesPaymentIntent(
  paymentIntentId: string,
  input: { quantity?: number; locationsCount?: number; currencyCode: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "Payment verification is not configured." };
  }

  const qty = parseOrderQuantity(input.quantity ?? MIN_QUANTITY);
  const loc = input.locationsCount ?? 0;
  const { total } = computeOrderTotal(qty, loc);
  const expectedAmount = toStripeAmount(total, input.currencyCode);

  const stripe = new Stripe(secret);
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return { ok: false, error: "Could not verify payment." };
  }

  if (pi.status !== "succeeded") {
    return { ok: false, error: "Payment has not completed successfully." };
  }
  if (pi.amount !== expectedAmount) {
    return { ok: false, error: "Payment amount does not match this order." };
  }
  const cur = (pi.currency ?? "").toLowerCase();
  if (cur !== input.currencyCode.toLowerCase().slice(0, 3)) {
    return { ok: false, error: "Currency mismatch." };
  }
  return { ok: true };
}
