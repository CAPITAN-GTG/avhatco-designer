import Stripe from "stripe";
import {
  parseJobStatus,
  STRIPE_JOB_STATUS_METADATA_KEY,
  type JobStatus,
} from "@/lib/adminJobStatus";
import { stripeOrderNumberFromPaymentIntent } from "@/lib/orderNumber";

export type AdminPaymentRow = {
  id: string;
  orderNumber: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  customerLabel: string;
  jobStatus: JobStatus;
};

export function parseMonthQuery(value?: string): { year: number; month: number; value: string } {
  const now = new Date();
  const fallback = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };

  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return {
      ...fallback,
      value: `${fallback.year}-${String(fallback.month).padStart(2, "0")}`,
    };
  }

  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) {
    return {
      ...fallback,
      value: `${fallback.year}-${String(fallback.month).padStart(2, "0")}`,
    };
  }

  return { year, month, value };
}

function monthRangeUnix(year: number, month: number): { start: number; end: number } {
  const start = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
  const end = Math.floor(new Date(year, month, 0, 23, 59, 59, 999).getTime() / 1000);
  return { start, end };
}

function customerLabel(paymentIntent: Stripe.PaymentIntent): string {
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

  return "Unknown customer";
}

function mapPaymentIntent(paymentIntent: Stripe.PaymentIntent): AdminPaymentRow {
  const paidAt =
    paymentIntent.status === "succeeded"
      ? new Date(paymentIntent.created * 1000)
      : null;

  return {
    id: paymentIntent.id,
    orderNumber: stripeOrderNumberFromPaymentIntent(paymentIntent),
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    createdAt: new Date(paymentIntent.created * 1000),
    paidAt,
    customerLabel: customerLabel(paymentIntent),
    jobStatus: parseJobStatus(paymentIntent.metadata?.[STRIPE_JOB_STATUS_METADATA_KEY]),
  };
}

export async function fetchAdminPaymentsForMonth(
  year: number,
  month: number
): Promise<AdminPaymentRow[]> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const stripe = new Stripe(secret);
  const { start, end } = monthRangeUnix(year, month);
  const rows: AdminPaymentRow[] = [];
  let startingAfter: string | undefined;

  do {
    const page = await stripe.paymentIntents.list({
      created: { gte: start, lte: end },
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.latest_charge"],
    });

    for (const paymentIntent of page.data) {
      rows.push(mapPaymentIntent(paymentIntent));
    }

    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);

  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function monthTotalCents(payments: AdminPaymentRow[]): number {
  return payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + payment.amount, 0);
}
