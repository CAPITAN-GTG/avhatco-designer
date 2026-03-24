"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { toast } from "react-toastify";
import { sendOrderEmailsAfterPayment } from "../actions/sendOrderEmails";
import type { SendOrderEmailsInput } from "../actions/sendOrderEmails";
import { computeOrderTotal, parseOrderQuantity } from "@/lib/pricing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

/** Session key so we can send the order email after a 3DS redirect. */
export const PAID_ORDER_PENDING_KEY = "custom-designer-paid-order-pending";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function PaymentForm({
  amountLabel,
  orderPayload,
  currencyCode,
  onDone,
}: {
  amountLabel: string;
  orderPayload: SendOrderEmailsInput;
  currencyCode: string;
  onDone: (success: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const pending = { ...orderPayload, currencyCode };
      try {
        sessionStorage.setItem(PAID_ORDER_PENDING_KEY, JSON.stringify(pending));
      } catch {
        // Payload may exceed sessionStorage quota; redirect recovery might not work.
      }
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (error) {
        sessionStorage.removeItem(PAID_ORDER_PENDING_KEY);
        toast.error(error.message ?? "Payment failed");
        onDone(false);
        return;
      }
      if (paymentIntent?.status === "succeeded" && paymentIntent.id) {
        sessionStorage.removeItem(PAID_ORDER_PENDING_KEY);
        const result = await sendOrderEmailsAfterPayment({
          ...orderPayload,
          paymentIntentId: paymentIntent.id,
          currencyCode,
        });
        if (result.success) {
          onDone(true);
        } else {
          toast.error(result.error);
          onDone(false);
        }
        return;
      }
      // Otherwise Stripe is redirecting (e.g. 3DS); sessionStorage keeps the order.
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || busy}
        className="text-sm px-4 py-2.5 rounded-lg bg-[#111827] text-white hover:bg-[#1f2937] disabled:opacity-50 w-full"
      >
        {busy ? "Processing…" : `Pay ${amountLabel}`}
      </button>
    </form>
  );
}

export function StripeCheckoutModal({
  open,
  onOpenChange,
  quantity,
  locations,
  currencyCode,
  orderPayload,
  onOrderComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quantity: string;
  locations: number;
  currencyCode: string;
  orderPayload: SendOrderEmailsInput | null;
  onOrderComplete: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      return;
    }
    if (!orderPayload || !stripePromise) return;
    let cancelled = false;
    setPreparing(true);
    setClientSecret(null);
    void (async () => {
      try {
        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity, locations, currency: currencyCode }),
        });
        const data = (await res.json()) as { clientSecret?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not start checkout");
        }
        if (!data.clientSecret) {
          throw new Error("Missing payment session");
        }
        if (!cancelled) setClientSecret(data.clientSecret);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Something went wrong");
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderPayload, quantity, locations, currencyCode, onOpenChange]);

  const qty = parseOrderQuantity(quantity);
  const { total } = computeOrderTotal(qty, locations);
  const amountLabel = `${currencyCode} ${total.toFixed(2)}`;

  function handlePaymentDone(success: boolean) {
    if (success) {
      onOrderComplete();
      onOpenChange(false);
    }
  }

  if (!publishableKey) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Checkout unavailable</DialogTitle>
            <DialogDescription>
              Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable card checkout.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>
            Pay securely. Your order email is sent only after the payment succeeds.
          </DialogDescription>
        </DialogHeader>
        {preparing ? (
          <p className="text-sm text-[#6b7280] py-6 text-center">Preparing secure checkout…</p>
        ) : clientSecret && orderPayload && stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: "stripe", variables: { borderRadius: "8px" } },
            }}
          >
            <PaymentForm
              amountLabel={amountLabel}
              orderPayload={orderPayload}
              currencyCode={currencyCode}
              onDone={handlePaymentDone}
            />
          </Elements>
        ) : (
          !preparing && (
            <p className="text-sm text-[#6b7280] py-4 text-center">
              Could not load payment form.
            </p>
          )
        )}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-3 w-full text-sm text-[#6b7280] hover:text-[#111827]"
        >
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}
