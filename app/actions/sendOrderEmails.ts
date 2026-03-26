"use server";

import fs from "fs";
import path from "path";
import { assertPaidOrderMatchesPaymentIntent } from "@/lib/stripeVerify";
import { sendMail, type EmailAttachment } from "../lib/email";

export type SendOrderEmailsInput = {
  customerEmail: string;
  productId: string;
  productTitle: string;
  productPrice?: string;
  quantity?: number;
  totalPrice?: string;
  note?: string;
  phone?: string;
  /** Number of design locations (front + side). When >= 2, price is doubled. */
  locationsCount?: number;
  frontImageDataUrl?: string;
  sideImageDataUrl?: string;
  /** User's design/artwork only (for download), JPEG */
  frontDesignOnlyDataUrl?: string;
  sideDesignOnlyDataUrl?: string;
  decorationType?: "embroidery" | "leather";
  /** @deprecated Kept for older payloads; embroidery is implied by decoration type. */
  embroideryPreference?: "yes" | "no";
  leatherOutline?: string;
  leatherColor?: string;
  /** Full-resolution die-cut shape file (business email only). */
  dieCutShapeHighResDataUrl?: string;
};

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/i);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

function dieCutShapeAttachmentName(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;]+);base64,/i);
  if (!m) return "die-cut-patch-shape.bin";
  const mime = m[1].toLowerCase();
  const extByMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "application/postscript": "eps",
    "application/illustrator": "ai",
  };
  const ext = extByMime[mime] ?? "bin";
  return `die-cut-patch-shape.${ext}`;
}

async function deliverOrderEmails(
  input: SendOrderEmailsInput
): Promise<{ success: true } | { success: false; error: string }> {
  const email = input.customerEmail?.trim();
  if (!email) return { success: false, error: "Email is required" };
  if (!input.productId || !input.productTitle) {
    return { success: false, error: "Please select a product" };
  }
  const requiresDesignImage =
    input.decorationType === "embroidery" ||
    (input.decorationType === "leather" && input.leatherOutline !== "die cut");
  const hasDesignImage =
    input.decorationType === "leather"
      ? Boolean(input.frontDesignOnlyDataUrl)
      : Boolean(input.frontImageDataUrl || input.sideImageDataUrl);
  if (requiresDesignImage && !hasDesignImage) {
    return {
      success: false,
      error:
        input.decorationType === "leather"
          ? "Please upload a front design image for your leatherette patch."
          : "Please upload at least one design image (front or side)",
    };
  }
  if (
    input.decorationType === "leather" &&
    input.leatherOutline === "die cut" &&
    !input.dieCutShapeHighResDataUrl
  ) {
    return {
      success: false,
      error: "Die-cut patch shape image is required for die-cut leatherette orders.",
    };
  }

  try {
    const businessEmail = process.env.EMAIL_USER?.trim();
    if (!businessEmail) {
      return { success: false, error: "Server: EMAIL_USER not configured" };
    }

    const MIN_QUANTITY = 12;
    const qty = Math.max(MIN_QUANTITY, input.quantity ?? MIN_QUANTITY);
    const isDoubleLocation =
      input.decorationType !== "leather" && (input.locationsCount ?? 0) >= 2;
    const priceReasonText = isDoubleLocation
      ? " (Price is doubled because the design is applied to both front and side.)"
      : "";
    const priceReasonHtml = isDoubleLocation
      ? '<p style="margin:0.25em 0 0;font-size:13px;color:#4b5563;">Price is doubled because the design is applied to both front and side.</p>'
      : "";
    const quantityDiscountNote = " (Per-unit rate by quantity.)";
    const quantityDiscountNoteHtml =
      '<p style="margin:0.25em 0 0;font-size:12px;color:#6b7280;">Per-unit rate by quantity.</p>';

    const trimmedPhone = input.phone?.trim();

    // Single decoration block: either embroidery OR leatherette (not DTF)
    const decorationText =
      input.decorationType === "embroidery"
        ? "Decoration: Embroidery\n"
        : input.decorationType === "leather"
          ? [
              "Decoration: Leatherette patch\n",
              input.leatherOutline ? `Outline: ${input.leatherOutline}\n` : "",
              input.leatherColor ? `Color: ${input.leatherColor}\n` : "",
            ].join("")
          : "";

    const decorationHtml =
      input.decorationType === "embroidery"
        ? `<section style="margin:1em 0"><strong>Decoration</strong><br/>Type: Embroidery</section>`
        : input.decorationType === "leather"
          ? `<section style="margin:1em 0"><strong>Decoration</strong><br/>Type: Leatherette patch${input.leatherOutline ? `<br/>Outline: ${input.leatherOutline}` : ""}${input.leatherColor ? `<br/>Color: ${input.leatherColor}` : ""}</section>`
          : "";

    const priceText =
      input.productPrice && input.totalPrice
        ? `Unit price: ${input.productPrice}\nQuantity: ${qty}\nSetup fee: $35\nTotal: ${input.totalPrice}${priceReasonText}${quantityDiscountNote}\n`
        : input.productPrice
          ? `Unit price: ${input.productPrice}\nQuantity: ${qty}\nSetup fee: $35${priceReasonText}${quantityDiscountNote}\n`
          : "";
    const priceHtml =
      input.productPrice
        ? `<section style="margin:1em 0"><strong>Unit price:</strong> ${input.productPrice}<br/><strong>Quantity:</strong> ${qty}<br/><strong>Setup fee:</strong> $35${input.totalPrice ? `<br/><strong>Total:</strong> ${input.totalPrice}` : ""}${priceReasonHtml}${quantityDiscountNoteHtml}</section>`
        : "";

    const noteText = input.note?.trim() ? `Note: ${input.note.trim()}\n` : "";
    const noteHtml = input.note?.trim()
      ? `<section style="margin:1em 0"><strong>Note:</strong> ${input.note.trim()}</section>`
      : "";

    // Design preview & artwork attachments
    const compositeAttachments: EmailAttachment[] = [];
    if (input.frontImageDataUrl) {
      const buf = dataUrlToBuffer(input.frontImageDataUrl);
      if (buf) compositeAttachments.push({ filename: "design-front-preview.png", content: buf });
    }
    if (input.sideImageDataUrl) {
      const buf = dataUrlToBuffer(input.sideImageDataUrl);
      if (buf) compositeAttachments.push({ filename: "design-side-preview.png", content: buf });
    }
    const businessAttachments: EmailAttachment[] = [...compositeAttachments];
    if (input.frontDesignOnlyDataUrl) {
      const buf = dataUrlToBuffer(input.frontDesignOnlyDataUrl);
      if (buf) businessAttachments.push({ filename: "design-front-artwork.png", content: buf });
    }
    if (input.sideDesignOnlyDataUrl) {
      const buf = dataUrlToBuffer(input.sideDesignOnlyDataUrl);
      if (buf) businessAttachments.push({ filename: "design-side-artwork.png", content: buf });
    }
    if (input.dieCutShapeHighResDataUrl) {
      const buf = dataUrlToBuffer(input.dieCutShapeHighResDataUrl);
      if (buf) {
        businessAttachments.push({
          filename: dieCutShapeAttachmentName(input.dieCutShapeHighResDataUrl),
          content: buf,
        });
      }
    }

    // Inline logo for email header (from public/logo.png)
    let logoAttachment: EmailAttachment | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      const logoBuffer = await fs.promises.readFile(logoPath);
      logoAttachment = {
        filename: "logo.png",
        content: logoBuffer,
        cid: "brand-logo",
      };
    } catch {
      // If logo can't be read, continue without inline logo.
    }

    const customerAttachments: EmailAttachment[] = [...compositeAttachments];
    if (logoAttachment) {
      customerAttachments.push(logoAttachment);
      businessAttachments.push(logoAttachment);
    }

    // Plain-text body: ordered sections for client and business (no attachment list in body)
    const customerTextSections = [
      `Product: ${input.productTitle}`,
      priceText,
      decorationText,
      noteText,
      "Custom orders typically take 7–14 business days to produce and ship. We’ll follow up by email with proofs and next steps.",
    ].filter(Boolean);
    const businessTextSections = [
      `Customer: ${email}`,
      trimmedPhone ? `Phone: ${trimmedPhone}` : "",
      `Product: ${input.productTitle}`,
      priceText,
      decorationText,
      noteText,
    ].filter(Boolean);

    const emailStyles = {
      wrap: "max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827;",
      header: "padding:24px 28px;background:#111827;color:#fff;text-align:center;",
      logo: "font-size:22px;font-weight:700;letter-spacing:0.02em;",
      body: "padding:28px;background:#fff;",
      section: "margin:0 0 20px;padding:0;",
      label: "font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin:0 0 4px;",
      value: "font-size:15px;color:#111827;margin:0;",
      footer: "padding:20px 28px;font-size:13px;color:#6b7280;background:#f9fafb;border-top:1px solid #e5e7eb;",
    };

    const decorationInline =
      input.decorationType === "embroidery"
        ? "Type: Embroidery"
        : input.decorationType === "leather"
          ? `Type: Leatherette patch${input.leatherOutline ? ` · Outline: ${input.leatherOutline}` : ""}${input.leatherColor ? ` · Color: ${input.leatherColor}` : ""}`
          : "";

    const customerHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f4f6;">
  <div style="${emailStyles.wrap}">
    <div style="${emailStyles.header}">
      <div style="${emailStyles.logo}">
        <img src="cid:brand-logo" alt="AVhatco" style="max-width:140px;height:auto;display:block;margin:0 auto;" />
      </div>
      <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Order confirmation</p>
    </div>
    <div style="${emailStyles.body}">
      <p style="margin:0 0 20px;font-size:15px;">Thank you for your order.</p>
      <section style="${emailStyles.section}">
        <p style="${emailStyles.label}">Product</p>
        <p style="${emailStyles.value}">${input.productTitle}</p>
      </section>
      ${input.productPrice ? `<section style="${emailStyles.section}"><p style="${emailStyles.label}">Pricing</p><p style="${emailStyles.value}">Unit price: ${input.productPrice}<br/>Quantity: ${qty}<br/>Setup fee: $35${input.totalPrice ? `<br/><strong>Total: ${input.totalPrice}</strong>` : ""}${priceReasonHtml}</p></section>` : ""}
      ${decorationInline ? `<section style="${emailStyles.section}"><p style="${emailStyles.label}">Decoration</p><p style="${emailStyles.value}">${decorationInline}</p></section>` : ""}
      ${input.note?.trim() ? `<section style="${emailStyles.section}"><p style="${emailStyles.label}">Note</p><p style="${emailStyles.value}">${input.note.trim()}</p></section>` : ""}
      <section style="${emailStyles.section}">
        <p style="${emailStyles.label}">Timeline</p>
        <p style="${emailStyles.value}">Custom orders typically take <strong>7–14 business days</strong> to produce and ship. We’ll email you with proofs and next steps.</p>
      </section>
    </div>
    <div style="${emailStyles.footer}">AVhatco · Custom hat request</div>
  </div>
</body>
</html>`;

    const businessHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f4f6;">
  <div style="${emailStyles.wrap}">
    <div style="${emailStyles.header}">
      <div style="${emailStyles.logo}">
        <img src="cid:brand-logo" alt="AVhatco" style="max-width:140px;height:auto;display:block;margin:0 auto;" />
      </div>
      <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">New order alert</p>
    </div>
    <div style="${emailStyles.body}">
      <section style="${emailStyles.section}">
        <p style="${emailStyles.label}">Customer</p>
        <p style="${emailStyles.value}">${email}</p>
      </section>
      ${trimmedPhone ? `<section style="${emailStyles.section}"><p style="${emailStyles.label}">Phone</p><p style="${emailStyles.value}">${trimmedPhone}</p></section>` : ""}
      <section style="${emailStyles.section}">
        <p style="${emailStyles.label}">Product</p>
        <p style="${emailStyles.value}">${input.productTitle}</p>
      </section>
      ${input.productPrice ? `<section style="${emailStyles.section}"><p style="${emailStyles.label}">Pricing</p><p style="${emailStyles.value}">Unit price: ${input.productPrice}<br/>Quantity: ${qty}<br/>Setup fee: $35${input.totalPrice ? `<br/><strong>Total: ${input.totalPrice}</strong>` : ""}${priceReasonHtml}</p></section>` : ""}
      ${decorationInline ? `<section style="${emailStyles.section}"><p style="${emailStyles.label}">Decoration</p><p style="${emailStyles.value}">${decorationInline}</p></section>` : ""}
      ${input.note?.trim() ? `<section style="${emailStyles.section}"><p style="${emailStyles.label}">Note</p><p style="${emailStyles.value}">${input.note.trim()}</p></section>` : ""}
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Design images are attached to this email.</p>
    </div>
    <div style="${emailStyles.footer}">AVhatco · Custom hat request</div>
  </div>
</body>
</html>`;

    // 1. Order confirmation to customer: composites only (no design-only artwork)
    await sendMail({
      to: email,
      subject: "𐚁 Order confirmation – AVhatco",
      text: `Thank you for your order.\n\n${customerTextSections.join("\n")}`,
      html: customerHtml,
      attachments: customerAttachments.length > 0 ? customerAttachments : undefined,
    });

    // 2. Order alert to business: composites + design-only artwork for production
    await sendMail({
      to: businessEmail,
      subject: "𐚁 New order alert – AVhatco",
      text: `New order submitted.\n\n${businessTextSections.join("\n")}`,
      html: businessHtml,
      attachments: businessAttachments,
    });

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send emails";
    return { success: false, error: message };
  }
}

export async function sendOrderEmailsAfterPayment(
  input: SendOrderEmailsInput & { paymentIntentId: string; currencyCode: string }
): Promise<{ success: true } | { success: false; error: string }> {
  const verified = await assertPaidOrderMatchesPaymentIntent(input.paymentIntentId, {
    quantity: input.quantity,
    locationsCount: input.locationsCount,
    currencyCode: input.currencyCode,
    decorationType: input.decorationType,
  });
  if (!verified.ok) {
    return { success: false, error: verified.error };
  }
  const { paymentIntentId: _pid, currencyCode: _cc, ...emailInput } = input;
  return deliverOrderEmails(emailInput);
}
