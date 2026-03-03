

import { useState } from "react";
import { sendOrderEmails } from "../actions/sendOrderEmails";
import type { ShopifyProduct } from "../lib/shopify";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type DecorationType = "embroidery" | "leather";

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
        <span className="truncate text-[#111827]">{product.title}</span>
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
  const [decorationType, setDecorationType] = useState<DecorationType>("embroidery");
  const [embroideryPreference, setEmbroideryPreference] = useState<"yes" | "no" | null>(
    null
  );
  const [leatherOutline, setLeatherOutline] = useState<string | null>(null);
  const [leatherColor, setLeatherColor] = useState<string | null>(null);

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
      decorationType,
      embroideryPreference:
        decorationType === "embroidery" ? embroideryPreference ?? undefined : undefined,
      leatherOutline:
        decorationType === "leather" ? leatherOutline ?? undefined : undefined,
      leatherColor:
        decorationType === "leather" ? leatherColor ?? undefined : undefined,
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
      <h2 className="text-base sm:text-lg font-medium tracking-tight text-[#111827]">
        Order details
      </h2>
      <p className="text-xs sm:text-sm text-[#4b5563] mt-1 mb-5">
        Pick a product and send your request to the business inbox.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 text-[#374151]">Your email</span>
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
          <span className="block mb-1.5 text-[#374151]">Quantity</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) =>
              setQuantity(
                e.target.value ? Math.max(1, parseInt(e.target.value, 10) || 1) : 1
              )
            }
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#d1d5db] focus:border-[#9ca3af]"
          />
        </label>
        <div className="text-sm text-[#374151]">
          <span className="block mb-1 text-[#111827]">Decoration</span>
          <p className="text-xs text-[#4b5563] mb-2">
            Choose one: send either embroidery or leather patch details (not both).
          </p>
          <div className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden shadow-sm">
            <Tabs
              value={decorationType}
              onValueChange={(value) => {
                const next = (value as DecorationType) ?? "embroidery";
                setDecorationType(next);
                if (next === "embroidery") {
                  setLeatherOutline(null);
                  setLeatherColor(null);
                } else {
                  setEmbroideryPreference(null);
                }
              }}
              className="w-full"
            >
              <div className="flex w-full border-b border-[#e5e7eb] bg-[#fafafa]">
                <TabsList
                  variant="line"
                  className="w-full h-auto flex-1 rounded-none gap-0 p-0 bg-transparent border-0"
                >
                  <TabsTrigger
                    value="embroidery"
                    className="flex-1 rounded-none rounded-tl-xl border-0 border-r border-[#e5e7eb] bg-transparent py-3 text-sm font-medium text-[#6b7280] data-[state=active]:bg-white data-[state=active]:text-[#111827] data-[state=active]:shadow-[0_-1px_0_0_inset] data-[state=active]:border-r data-[state=active]:border-[#e5e7eb] hover:text-[#374151] hover:bg-white/50 after:hidden"
                  >
                    Embroidery
                  </TabsTrigger>
                  <TabsTrigger
                    value="leather"
                    className="flex-1 rounded-none rounded-tr-xl border-0 bg-transparent py-3 text-sm font-medium text-[#6b7280] data-[state=active]:bg-white data-[state=active]:text-[#111827] data-[state=active]:shadow-[0_-1px_0_0_inset] hover:text-[#374151] hover:bg-white/50 after:hidden"
                  >
                    Leather patch
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="embroidery" className="px-4 py-4">
                <div className="space-y-2">
                  <p className="text-xs text-[#4b5563]">Do you want embroidery?</p>
                  <div className="flex flex-col gap-1" role="radiogroup" aria-label="Embroidery preference">
                    <label className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="embroideryPreference"
                        className="h-3.5 w-3.5 border border-[#d1d5db] text-[#111827]"
                        checked={embroideryPreference === "yes"}
                        onChange={() => setEmbroideryPreference("yes")}
                      />
                      <span className="text-[#111827]">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="embroideryPreference"
                        className="h-3.5 w-3.5 border border-[#d1d5db] text-[#111827]"
                        checked={embroideryPreference === "no"}
                        onChange={() => setEmbroideryPreference("no")}
                      />
                      <span className="text-[#111827]">No</span>
                    </label>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="leather" className="px-4 py-4">
                <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#4b5563] mb-1.5">Patch outline</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] flex items-center gap-2.5 min-h-10 hover:bg-[#f9fafb]"
                      >
                        {leatherOutline ? (
                          <>
                            <span className="flex w-8 h-8 items-center justify-center rounded-md bg-[#f3f4f6] border border-[#e5e7eb]">
                              <span className="inline-block w-5 h-5 border border-dashed border-[#9ca3af] rounded-sm" />
                            </span>
                            <span className="truncate capitalize">{leatherOutline}</span>
                          </>
                        ) : (
                          <span className="text-[#888]">Choose outline</span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {["circle", "rectangle", "square", "trap", "custom outline"].map(
                        (shape) => (
                          <DropdownMenuItem
                            key={shape}
                            onSelect={() => setLeatherOutline(shape)}
                          >
                            <span className="flex w-8 h-8 items-center justify-center rounded-md bg-[#f3f4f6] border border-[#e5e7eb]">
                              {shape === "circle" ? (
                                <span className="inline-block w-5 h-5 rounded-full border border-dashed border-[#9ca3af]" />
                              ) : shape === "trap" ? (
                                <span className="inline-block w-5 h-5 border border-dashed border-[#9ca3af] [clip-path:polygon(10%_0,100%_0,90%_100%,0_100%)]" />
                              ) : (
                                <span className="inline-block w-5 h-5 border border-dashed border-[#9ca3af] rounded-sm" />
                              )}
                            </span>
                            <span className="capitalize">{shape}</span>
                          </DropdownMenuItem>
                        )
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div>
                  <p className="text-xs text-[#4b5563] mb-1.5">Leather color</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] flex items-center gap-2.5 min-h-10 hover:bg-[#f9fafb]"
                      >
                        {leatherColor ? (
                          <>
                            <span className="flex w-8 h-8 items-center justify-center rounded-md bg-[#f3f4f6] border border-[#e5e7eb] overflow-hidden">
                              <span className="w-full h-full flex">
                                <span className="w-1/2 h-full bg-[#92400e]" />
                                <span className="w-1/2 h-full bg-black" />
                              </span>
                            </span>
                            <span className="truncate capitalize">{leatherColor}</span>
                          </>
                        ) : (
                          <span className="text-[#888]">Choose color</span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {[
                        "rawhide/black",
                        "gray/black",
                        "light brown/black",
                        "dark brown/black",
                        "white/gold",
                      ].map((combo) => (
                        <DropdownMenuItem
                          key={combo}
                          onSelect={() => setLeatherColor(combo)}
                        >
                          <span className="flex w-8 h-8 items-center justify-center rounded-md bg-[#f3f4f6] border border-[#e5e7eb] overflow-hidden">
                            <span className="w-full h-full flex">
                              <span className="w-1/2 h-full bg-[#e5b27b]" />
                              <span className="w-1/2 h-full bg-black" />
                            </span>
                          </span>
                          <span className="capitalize">{combo}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 text-[#374151]">Select product</span>
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
                        <span className="w-full h-full flex items-center justify-center text-[10px] text-[#888]">
                          —
                        </span>
                      )}
                    </span>
                    <span className="truncate">
                      {selectedProduct.title} ·{" "}
                      {selectedProduct.priceRange.minVariantPrice.currencyCode}{" "}
                      {selectedProduct.priceRange.minVariantPrice.amount}
                    </span>
                  </>
                ) : (
                  <span className="text-[#888]">— Choose one —</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-[16rem] sm:min-w-[18rem]"
            >
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
            <p className="text-xs uppercase tracking-[0.08em] text-[#6b7280]">
              Estimated total
            </p>
            <p className="text-base text-[#111827] mt-0.5">{calculatedTotal}</p>
          </div>
        )}
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 text-[#374151]">Note (optional)</span>
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
          className="text-sm px-4 py-2.5 rounded-lg bg-[#111827] text-white hover:bg-[#1f2937] disabled:opacity-50 w-full"
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
