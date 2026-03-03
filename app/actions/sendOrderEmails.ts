"use server";

import { sendMail } from "../lib/email";

export type SendOrderEmailsInput = {
  customerEmail: string;
  productId: string;
  productTitle: string;
  productPrice?: string;
  quantity?: number;
  totalPrice?: string;
  note?: string;
  frontImageDataUrl?: string;
  sideImageDataUrl?: string;
  decorationType?: "embroidery" | "leather";
  embroideryPreference?: "yes" | "no";
  leatherOutline?: string;
  leatherColor?: string;
};

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

export async function sendOrderEmails(
  input: SendOrderEmailsInput
): Promise<{ success: true } | { success: false; error: string }> {
  const email = input.customerEmail?.trim();
  if (!email) return { success: false, error: "Email is required" };
  if (!input.productId || !input.productTitle) {
    return { success: false, error: "Please select a product" };
  }
  if (!input.frontImageDataUrl && !input.sideImageDataUrl) {
    return { success: false, error: "Please upload at least one design image (front or side)" };
  }

  try {
    const businessEmail = process.env.EMAIL_USER?.trim();
    if (!businessEmail) {
      return { success: false, error: "Server: EMAIL_USER not configured" };
    }

    const qty = input.quantity ?? 1;

    // Single decoration block: either embroidery OR leather (never both)
    const decorationText =
      input.decorationType === "embroidery" && input.embroideryPreference
        ? `Decoration: Embroidery\nWanted: ${input.embroideryPreference === "yes" ? "Yes" : "No"}\n`
        : input.decorationType === "leather"
          ? [
              "Decoration: Leather patch\n",
              input.leatherOutline ? `Outline: ${input.leatherOutline}\n` : "",
              input.leatherColor ? `Color: ${input.leatherColor}\n` : "",
            ].join("")
          : "";

    const decorationHtml =
      input.decorationType === "embroidery" && input.embroideryPreference
        ? `<section style="margin:1em 0"><strong>Decoration</strong><br/>Type: Embroidery<br/>Wanted: ${input.embroideryPreference === "yes" ? "Yes" : "No"}</section>`
        : input.decorationType === "leather"
          ? `<section style="margin:1em 0"><strong>Decoration</strong><br/>Type: Leather patch${input.leatherOutline ? `<br/>Outline: ${input.leatherOutline}` : ""}${input.leatherColor ? `<br/>Color: ${input.leatherColor}` : ""}</section>`
          : "";

    const priceText =
      input.productPrice && input.totalPrice
        ? `Unit price: ${input.productPrice}\nQuantity: ${qty}\nTotal: ${input.totalPrice}\n`
        : input.productPrice
          ? `Unit price: ${input.productPrice}\nQuantity: ${qty}\n`
          : "";
    const priceHtml =
      input.productPrice
        ? `<section style="margin:1em 0"><strong>Unit price:</strong> ${input.productPrice}<br/><strong>Quantity:</strong> ${qty}${input.totalPrice ? `<br/><strong>Total:</strong> ${input.totalPrice}` : ""}</section>`
        : "";

    const noteText = input.note?.trim() ? `Note: ${input.note.trim()}\n` : "";
    const noteHtml = input.note?.trim()
      ? `<section style="margin:1em 0"><strong>Note:</strong> ${input.note.trim()}</section>`
      : "";

    const attachments: { filename: string; content: Buffer }[] = [];
    if (input.frontImageDataUrl) {
      const buf = dataUrlToBuffer(input.frontImageDataUrl);
      if (buf) attachments.push({ filename: "design-preview-front.png", content: buf });
    }
    if (input.sideImageDataUrl) {
      const buf = dataUrlToBuffer(input.sideImageDataUrl);
      if (buf) attachments.push({ filename: "design-preview-side.png", content: buf });
    }
    const attachmentHtml =
      attachments.length > 0
        ? `<section style="margin:1em 0"><strong>Design previews attached:</strong> ${attachments.map((a) => a.filename).join(", ")}</section>`
        : "";

    // Plain-text body: ordered sections for client and business
    const customerTextSections = [
      `Product: ${input.productTitle}`,
      priceText,
      decorationText,
      noteText,
      "We will process your request shortly.",
    ].filter(Boolean);
    const businessTextSections = [
      `Customer: ${email}`,
      `Product: ${input.productTitle}`,
      priceText,
      decorationText,
      noteText,
      attachments.length > 0 ? `Attachments: ${attachments.map((a) => a.filename).join(", ")}` : "",
    ].filter(Boolean);

    // 1. Order confirmation to customer (clear order, no attachments in body text)
    await sendMail({
      to: email,
      subject: "Order confirmation",
      text: `Thank you for your order.\n\n${customerTextSections.join("\n")}`,
      html: `<p>Thank you for your order.</p><section style="margin:1em 0"><strong>Product:</strong> ${input.productTitle}</section>${priceHtml}${decorationHtml}${noteHtml}<p>We will process your request shortly.</p>`,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    // 2. Order alert to business (same order, plus attachments list)
    await sendMail({
      to: businessEmail,
      subject: "New order alert",
      text: `New order submitted.\n\n${businessTextSections.join("\n")}`,
      html: `<p>New order submitted.</p><section style="margin:1em 0"><strong>Customer:</strong> ${email}</section><section style="margin:1em 0"><strong>Product:</strong> ${input.productTitle}</section>${priceHtml}${decorationHtml}${noteHtml}${attachmentHtml}`,
      attachments,
    });

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send emails";
    return { success: false, error: message };
  }
}
