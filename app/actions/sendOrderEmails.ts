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
    const priceLine = input.productPrice
      ? `Unit price: ${input.productPrice}\nQuantity: ${qty}\n${input.totalPrice ? `Total: ${input.totalPrice}\n` : ""}`
      : "";
    const noteLine = input.note?.trim() ? `Note: ${input.note.trim()}\n` : "";

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
        ? `<p><strong>Design previews attached:</strong> ${attachments.map((a) => a.filename).join(", ")}</p>`
        : "";
    const priceHtml = input.productPrice
      ? `<p><strong>Unit price:</strong> ${input.productPrice}</p><p><strong>Quantity:</strong> ${qty}</p>${input.totalPrice ? `<p><strong>Total:</strong> ${input.totalPrice}</p>` : ""}`
      : "";
    const noteHtml = input.note?.trim() ? `<p><strong>Note:</strong> ${input.note.trim()}</p>` : "";

    // 1. Order confirmation to customer
    await sendMail({
      to: email,
      subject: "Order confirmation",
      text: `Thank you for your order.\n\nProduct: ${input.productTitle}\n${priceLine}${noteLine}\nWe will process your request shortly.`,
      html: `<p>Thank you for your order.</p><p><strong>Product:</strong> ${input.productTitle}</p>${priceHtml}${noteHtml}<p>We will process your request shortly.</p>`,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    // 2. Order alert to business
    await sendMail({
      to: businessEmail,
      subject: "New order alert",
      text: `New order submitted.\n\nCustomer email: ${email}\nProduct: ${input.productTitle}\n${priceLine}${noteLine}`,
      html: `<p>New order submitted.</p><p><strong>Customer email:</strong> ${email}</p><p><strong>Product:</strong> ${input.productTitle}</p>${priceHtml}${noteHtml}${attachmentHtml}`,
      attachments,
    });

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send emails";
    return { success: false, error: message };
  }
}
