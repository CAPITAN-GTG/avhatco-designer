import Stripe from "stripe";
import {
  STRIPE_JOB_STATUS_METADATA_KEY,
  type JobStatus,
} from "@/lib/adminJobStatus";

function getStripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secret);
}

export async function setStripePaymentJobStatus(
  paymentIntentId: string,
  status: JobStatus
): Promise<void> {
  const stripe = getStripeClient();
  const existing = await stripe.paymentIntents.retrieve(paymentIntentId);

  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: {
      ...existing.metadata,
      [STRIPE_JOB_STATUS_METADATA_KEY]: status,
    },
  });
}
