import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { DecorationType } from "@/lib/decoration";
import {
  computeOrderTotal,
  MIN_QUANTITY,
  parseOrderQuantity,
  toStripeAmount,
} from "@/lib/pricing";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Payments are not configured (missing STRIPE_SECRET_KEY)." },
      { status: 500 }
    );
  }

  let body: {
    quantity?: unknown;
    locations?: unknown;
    currency?: unknown;
    decorationType?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const qtyRaw = body.quantity;
  const qtyInput =
    typeof qtyRaw === "string" || typeof qtyRaw === "number" ? qtyRaw : MIN_QUANTITY;
  const qty = parseOrderQuantity(qtyInput);
  const locations =
    typeof body.locations === "number" && !Number.isNaN(body.locations)
      ? Math.max(0, Math.floor(body.locations))
      : 0;
  const currencyRaw = typeof body.currency === "string" ? body.currency.trim() : "usd";
  const currency = currencyRaw.toLowerCase().slice(0, 3) || "usd";
  const decorationRaw = body.decorationType;
  const decorationType: DecorationType =
    decorationRaw === "leather" ? "leather" : "embroidery";

  const { total } = computeOrderTotal(qty, locations, decorationType);
  const amount = toStripeAmount(total, currency);

  if (amount < 50) {
    return NextResponse.json({ error: "Amount is too small to charge." }, { status: 400 });
  }

  const stripe = new Stripe(secret);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        quantity: String(qty),
        locations: String(locations),
        decorationType,
      },
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "Could not create payment session." },
        { status: 500 }
      );
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Payment could not be started.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
