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
      <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md overflow-hidden bg-[#f3f4f6] border border-[#e5e7eb]">
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
        <span className="truncate font-medium text-[#111827]">{product.title}</span>
        <span className="text-xs text-[#6b7280]">{price}</span>
      </span>
    </DropdownMenuItem>
  );
}

export default function OrderForm({
  products,
  productId,
  setProductId,
  getPreviewImages,
}: {
  products: ShopifyProduct[];
  productId: string;
  setProductId: (id: string) => void;
  getPreviewImages?: () => Promise<{ front?: string; side?: string }>;
}) {
  const [email, setEmail] = useState("");
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
    const previewImages: { front?: string; side?: string } =
      (await getPreviewImages?.().catch(() => ({}))) ?? {};
    if (!previewImages.front && !previewImages.side) {
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
    <div className="w-full xl:sticky xl:top-8">
      <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[#111827]">Order details</h2>
      <p className="text-xs sm:text-sm text-[#4b5563] mt-1 mb-5">
        Pick a product and send your request to the business inbox.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 font-medium">Your email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#d1d5db] focus:border-[#9ca3af]"
          />
        </label>
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 font-medium">Quantity</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value ? Math.max(1, parseInt(e.target.value, 10) || 1) : 1)}
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#d1d5db] focus:border-[#9ca3af]"
          />
        </label>
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 font-medium">Select product</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] flex items-center gap-2.5 min-h-10 hover:bg-[#f9fafb]"
              >
                {selectedProduct ? (
                  <>
                    <span className="flex w-9 h-9 shrink-0 rounded-md overflow-hidden bg-[#f3f4f6] border border-[#e5e7eb]">
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
                      {selectedProduct.title} · {selectedProduct.priceRange.minVariantPrice.currencyCode}{" "}
                      {selectedProduct.priceRange.minVariantPrice.amount}
                    </span>
                  </>
                ) : (
                  <span className="text-[#888]">— Choose one —</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[16rem] sm:min-w-[18rem]">
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
          <div className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#6b7280]">Estimated total</p>
            <p className="text-base font-semibold text-[#111827] mt-0.5">{calculatedTotal}</p>
          </div>
        )}
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 font-medium">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any special instructions..."
            rows={3}
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] resize-y placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#d1d5db] focus:border-[#9ca3af]"
          />
        </label>
        <button
          type="submit"
          disabled={status === "sending"}
          className="text-sm font-medium px-4 py-2.5 rounded-lg bg-[#111827] text-white hover:bg-[#1f2937] disabled:opacity-50 w-full"
        >
          {status === "sending" ? "Sending…" : "Submit"}
        </button>
      </form>
      {status === "ok" && (
        <p className="text-sm text-emerald-700 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          {message}
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-700 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          {message}
        </p>
      )}
    </div>
  );
}
