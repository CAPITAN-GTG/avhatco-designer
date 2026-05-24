import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminAuth";
import {
  JOB_STATUS_VALUES,
  parseJobStatus,
  type JobStatus,
} from "@/lib/adminJobStatus";
import { setShopifyOrderJobStatus } from "@/lib/shopifyJobStatus";
import { setStripePaymentJobStatus } from "@/lib/stripeJobStatus";

export async function PATCH(request: Request) {
  const auth = await requireAdminSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: { source?: string; id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const source = body.source;
  const id = body.id?.trim();
  const status = body.status as JobStatus | undefined;

  if ((source !== "shopify" && source !== "stripe") || !id) {
    return NextResponse.json({ error: "Invalid source or id" }, { status: 400 });
  }

  if (!status || !JOB_STATUS_VALUES.includes(status)) {
    return NextResponse.json({ error: "Invalid job status" }, { status: 400 });
  }

  try {
    if (source === "shopify") {
      await setShopifyOrderJobStatus(id, status);
    } else {
      await setStripePaymentJobStatus(id, status);
    }

    return NextResponse.json({ ok: true, status: parseJobStatus(status) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update job status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
