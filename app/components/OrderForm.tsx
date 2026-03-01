"use client";

import { useState } from "react";
import { sendOrderEmails } from "../actions/sendOrderEmails";
import type { ShopifyProduct } from "../lib/shopify";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function ProductItem({
  product,
  onSelect,
}: {
  product: ShopifyProduct;
  onSelect: () => void;
}) {
  const price =
    `${product.priceRange.minVariantPrice.currencyCode} ${product.priceRange.minVariantPrice.amount}` +
    (product.priceRange.minVariantPrice.amount !== product.priceRange.maxVariantPrice.amount
      ? ` – ${product.priceRange.maxVariantPrice.amount}`
      : "");
  return (
    <DropdownMenuItem onSelect={onSelect} textValue={product.title}>
      <span className="flex w-8 h-8 shrink-0 items-center justify-center rounded overflow-hidden bg-[#f0f0f0]">
        {product.featuredImage?.url ? (
          <img
            src={product.featuredImage.url}
            alt={product.featuredImage.altText ?? product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-[#888]">—</span>
        )}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="truncate font-medium">{product.title}</span>
        <span className="text-xs text-[#555]">{price}</span>
      </span>
    </DropdownMenuItem>
  );
}

export default function OrderForm({
  products,
  getPreviewImages,
}: {
  products: ShopifyProduct[];
  getPreviewImages?: () => Promise<{ front?: string; side?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setStatus("error");
      setMessage("Please select a product");
      return;
    }
    if (!email.trim()) {
      setStatus("error");
      setMessage("Email is required");
      return;
    }
    const qty = Math.max(1, Math.floor(quantity));
    setStatus("sending");
    setMessage("");
    const { amount, currencyCode } = product.priceRange.minVariantPrice;
    const unitPrice = parseFloat(amount);
    const total = unitPrice * qty;
    const priceStr = `${currencyCode} ${amount}`;
    const totalStr = `${currencyCode} ${total.toFixed(2)}`;
    const previewImages = await getPreviewImages?.().catch(() => ({}));
    if (!previewImages?.front && !previewImages?.side) {
      setStatus("error");
      setMessage("Please upload at least one design image (front or side)");
      return;
    }
    const result = await sendOrderEmails({
      customerEmail: email.trim(),
      productId: product.id,
      productTitle: product.title,
      productPrice: priceStr,
      quantity: qty,
      totalPrice: totalStr,
      note: note.trim() || undefined,
      frontImageDataUrl: previewImages?.front,
      sideImageDataUrl: previewImages?.side,
    });
    if (result.success) {
      setStatus("ok");
      setMessage("Emails sent. Check your inbox and the business inbox.");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  if (products.length === 0) return null;

  const selectedProduct = productId ? products.find((x) => x.id === productId) : null;
  const unitPrice = selectedProduct
    ? parseFloat(selectedProduct.priceRange.minVariantPrice.amount)
    : 0;
  const qty = Math.max(1, Math.floor(quantity));
  const calculatedTotal = selectedProduct
    ? `${selectedProduct.priceRange.minVariantPrice.currencyCode} ${(unitPrice * qty).toFixed(2)}`
    : null;

  return (
    <div className="w-full lg:sticky lg:top-6">
      <h2 className="text-sm font-semibold text-[#444]">Order / Request</h2>
      <p className="text-xs text-[#666] mt-1 mb-4">
        Pick a product and send your request to the business inbox.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
        <label className="text-sm text-[#555]">
          <span className="block mb-1">Your email (required)</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full text-sm px-2 py-1.5 rounded border border-[#ddd] bg-[#fafafa] text-[#1a1a1a]"
          />
        </label>
        <label className="text-sm text-[#555]">
          <span className="block mb-1">Quantity</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value ? Math.max(1, parseInt(e.target.value, 10) || 1) : 1)}
            className="w-full text-sm px-2 py-1.5 rounded border border-[#ddd] bg-[#fafafa] text-[#1a1a1a]"
          />
        </label>
        <label className="text-sm text-[#555]">
          <span className="block mb-1">Select product</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full text-left text-sm px-2 py-1.5 rounded border border-[#ddd] bg-[#fafafa] text-[#1a1a1a] flex items-center gap-2 min-h-[2.25rem] hover:bg-[#f0f0f0]"
              >
                {selectedProduct ? (
                  <>
                    <span className="flex w-8 h-8 shrink-0 rounded overflow-hidden bg-[#eee]">
                      {selectedProduct.featuredImage?.url ? (
                        <img
                          src={selectedProduct.featuredImage.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-[10px] text-[#888]">—</span>
                      )}
                    </span>
                    <span className="truncate">
                      {selectedProduct.title} — {selectedProduct.priceRange.minVariantPrice.currencyCode}{" "}
                      {selectedProduct.priceRange.minVariantPrice.amount}
                    </span>
                  </>
                ) : (
                  <span className="text-[#888]">— Choose one —</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[16rem]">
              {products.map((p) => (
                <ProductItem
                  key={p.id}
                  product={p}
                  onSelect={() => setProductId(p.id)}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </label>
        {calculatedTotal != null && (
          <p className="text-sm text-[#444] font-medium">
            Total: {calculatedTotal}
          </p>
        )}
        <label className="text-sm text-[#555]">
          <span className="block mb-1">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any special instructions..."
            rows={3}
            className="w-full text-sm px-2 py-1.5 rounded border border-[#ddd] bg-[#fafafa] text-[#1a1a1a] resize-y"
          />
        </label>
        <button
          type="submit"
          disabled={status === "sending"}
          className="text-sm px-3 py-2 rounded bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-50 w-full"
        >
          {status === "sending" ? "Sending…" : "Submit"}
        </button>
      </form>
      {status === "ok" && <p className="text-sm text-emerald-600 mt-2">{message}</p>}
      {status === "error" && <p className="text-sm text-red-600 mt-2">{message}</p>}
    </div>
  );
}
