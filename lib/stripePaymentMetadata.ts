import Stripe from "stripe";
import {
  STRIPE_CUSTOMER_EMAIL_METADATA_KEY,
  STRIPE_ORDER_NUMBER_METADATA_KEY,
  STRIPE_PRODUCT_TITLE_METADATA_KEY,
} from "@/lib/adminJobStatus";

const METADATA_VALUE_MAX = 500;

function trimMetadataValue(value: string): string {
  return value.trim().slice(0, METADATA_VALUE_MAX);
}

export function buildStripeCustomerMetadata(input: {
  customerEmail?: string;
  productTitle?: string;
  orderNumber?: string;
}): Record<string, string> {
  const metadata: Record<string, string> = {};
  const email = input.customerEmail?.trim();
  const productTitle = input.productTitle?.trim();
  const orderNumber = input.orderNumber?.trim();

  if (email) {
    metadata[STRIPE_CUSTOMER_EMAIL_METADATA_KEY] = trimMetadataValue(email);
  }
  if (productTitle) {
    metadata[STRIPE_PRODUCT_TITLE_METADATA_KEY] = trimMetadataValue(productTitle);
  }
  if (orderNumber) {
    metadata[STRIPE_ORDER_NUMBER_METADATA_KEY] = trimMetadataValue(orderNumber);
  }

  return metadata;
}

export async function mergeStripePaymentMetadata(
  paymentIntentId: string,
  patch: Record<string, string>
): Promise<void> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || Object.keys(patch).length === 0) {
    return;
  }

  const stripe = new Stripe(secret);
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const receiptEmail = patch[STRIPE_CUSTOMER_EMAIL_METADATA_KEY]?.trim();

  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: {
      ...pi.metadata,
      ...patch,
    },
    ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
  });
}

export function customerLabelFromPaymentIntent(paymentIntent: Stripe.PaymentIntent): string {
  const metaEmail = paymentIntent.metadata?.[STRIPE_CUSTOMER_EMAIL_METADATA_KEY]?.trim();
  if (metaEmail) {
    return metaEmail;
  }

  if (paymentIntent.receipt_email) {
    return paymentIntent.receipt_email;
  }

  const charge = paymentIntent.latest_charge;
  if (typeof charge === "object" && charge !== null) {
    const email = charge.billing_details?.email;
    if (email) {
      return email;
    }
    const name = charge.billing_details?.name;
    if (name) {
      return name;
    }
  }

  const productTitle = paymentIntent.metadata?.[STRIPE_PRODUCT_TITLE_METADATA_KEY]?.trim();
  if (productTitle) {
    return productTitle;
  }

  const orderNumber = paymentIntent.metadata?.[STRIPE_ORDER_NUMBER_METADATA_KEY]?.trim();
  if (orderNumber) {
    return orderNumber;
  }

  return "Unknown customer";
}
