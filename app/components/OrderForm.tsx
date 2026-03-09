

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

const SETUP_FEE = 35;
const MIN_QUANTITY = 12;

/** Quantity tiers: [min quantity, price per unit]. Order descending by min qty so we can find tier by qty >= min. */
const QUANTITY_TIERS: [number, number][] = [
  [144, 14],
  [96, 15],
  [48, 16],
  [24, 18],
  [12, 20],
];

function getUnitPriceForQuantity(qty: number): number {
  const tier = QUANTITY_TIERS.find(([min]) => qty >= min);
  return tier ? tier[1] : QUANTITY_TIERS[QUANTITY_TIERS.length - 1]![1];
}

const PATCH_SHAPES: { value: string; label: string; image: string }[] = [
  { value: "circle", label: "Circle", image: "/circle.png" },
  { value: "rectangle", label: "Rectangle", image: "/rectangle.png" },
  { value: "hexagon short", label: "Hexagon short", image: "/hexagon-short.png" },
  { value: "hexagon long", label: "Hexagon long", image: "/hexagon-long.png" },
  { value: "die cut", label: "Die cut", image: "/die-cut.png" },
];

const LEATHER_COLORS: { value: string; label: string; image: string }[] = [
  { value: "Rawhide", label: "Rawhide", image: "/rawhide.jpeg" },
  { value: "Aluminum Gold", label: "Aluminum Gold", image: "/aluminum_gold.jpeg" },
  { value: "Aluminum Silver", label: "Aluminum Silver", image: "/aluminum_silver.jpeg" },
  { value: "Rustic Gold", label: "Rustic Gold", image: "/rustic_gold.jpeg" },
  { value: "Holographic Leatherette", label: "Holographic Leatherette", image: "/holographic_leatherette.jpeg" },
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  const len = digits.length;
  if (len <= 3) return digits;
  if (len <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

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
  locations = 0,
}: {
  products: ShopifyProduct[];
  productId: string;
  setProductId: (id: string) => void;
  getPreviewImages?: () => Promise<{
    front?: string;
    side?: string;
    frontDesignOnly?: string;
    sideDesignOnly?: string;
  }>;
  locations?: number;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState<string>(String(MIN_QUANTITY));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [decorationType, setDecorationType] = useState<DecorationType>("embroidery");
  const [embroideryPreference, setEmbroideryPreference] = useState<"yes" | "no">("no");
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
    const phoneDigits = phone.replace(/\D/g, "");
    if (phone && phoneDigits.length !== 10) {
      setStatus("error");
      setMessage("Please enter a valid 10-digit phone number or leave it blank.");
      return;
    }
    const qty =
      quantity === "" || quantity === null || Number(quantity) === 0 || Number.isNaN(Number(quantity))
        ? MIN_QUANTITY
        : Math.max(MIN_QUANTITY, Math.floor(Number(quantity)));
    setStatus("sending");
    setMessage("");
    const { currencyCode } = product.priceRange.minVariantPrice;
    const unitPrice = getUnitPriceForQuantity(qty);
    const locationMultiplier = locations >= 2 ? 2 : 1;
    const subtotal = unitPrice * qty * locationMultiplier;
    const total = subtotal + SETUP_FEE;
    const priceStr = `${currencyCode} ${unitPrice.toFixed(2)}`;
    const totalStr = `${currencyCode} ${total.toFixed(2)}`;
    const previewImages: {
      front?: string;
      side?: string;
      frontDesignOnly?: string;
      sideDesignOnly?: string;
    } = (await getPreviewImages?.().catch(() => ({}))) ?? {};
    if (!previewImages.front && !previewImages.side) {
      setStatus("error");
      setMessage("Please upload at least one design image (front or side)");
      return;
    }
    const result = await sendOrderEmails({
      customerEmail: email.trim(),
      phone: phoneDigits ? formatPhone(phone) : undefined,
      productId: product.id,
      productTitle: product.title,
      productPrice: priceStr,
      quantity: qty,
      totalPrice: totalStr,
      note: note.trim() || undefined,
      locationsCount: locations,
      decorationType,
      embroideryPreference:
        decorationType === "embroidery" ? embroideryPreference ?? undefined : undefined,
      leatherOutline:
        decorationType === "leather" ? leatherOutline ?? undefined : undefined,
      leatherColor:
        decorationType === "leather" ? leatherColor ?? undefined : undefined,
      frontImageDataUrl: previewImages?.front,
      sideImageDataUrl: previewImages?.side,
      frontDesignOnlyDataUrl: previewImages?.frontDesignOnly,
      sideDesignOnlyDataUrl: previewImages?.sideDesignOnly,
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
  const qty =
    quantity === "" || quantity === null || Number(quantity) === 0 || Number.isNaN(Number(quantity))
      ? MIN_QUANTITY
      : Math.max(MIN_QUANTITY, Math.floor(Number(quantity)));
  const unitPrice = getUnitPriceForQuantity(qty);
  const locationMultiplier = locations >= 2 ? 2 : 1;
  const currencyCode = selectedProduct?.priceRange.minVariantPrice.currencyCode ?? "USD";
  const subtotal = unitPrice * qty * locationMultiplier;
  const total = selectedProduct ? subtotal + SETUP_FEE : 0;
  const calculatedTotal =
    selectedProduct
      ? { currencyCode, subtotal, total }
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
          <span className="block mb-1.5 text-[#374151]">Phone number (optional)</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(555) 123-4567"
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#d1d5db] focus:border-[#9ca3af]"
          />
        </label>
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 text-[#374151]">Quantity</span>
          <input
            type="number"
            min={MIN_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={() => {
              const n = Number(quantity);
              if (quantity === "" || Number.isNaN(n) || n < MIN_QUANTITY) setQuantity(String(MIN_QUANTITY));
            }}
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#d1d5db] focus:border-[#9ca3af]"
          />
          <p className="text-xs text-[#6b7280] mt-1">
            Minimum order quantity is {MIN_QUANTITY} units. This allows us to maintain production efficiency and consistent quality for your order.
          </p>
        </label>
        <div className="text-sm text-[#374151]">
          <span className="block mb-1 text-[#111827]">Decoration</span>
          <p className="text-xs text-[#4b5563] mb-2">
            Choose one: send either embroidery or leatherette patch details (not both).
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
                  setEmbroideryPreference("no");
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
                    Leatherette patch
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="embroidery" className="px-4 py-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border border-[#d1d5db] text-[#111827]"
                    checked={embroideryPreference === "yes"}
                    onChange={(e) => setEmbroideryPreference(e.target.checked ? "yes" : "no")}
                  />
                  <span className="text-[#111827]">I want embroidery</span>
                </label>
              </TabsContent>
              <TabsContent value="leather" className="px-4 py-4">
                <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#4b5563] mb-1.5">Patch outline</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] flex items-center gap-3 min-h-14 sm:min-h-16 hover:bg-[#f9fafb]"
                      >
                        {leatherOutline ? (
                          (() => {
                            const shape = PATCH_SHAPES.find((s) => s.value === leatherOutline);
                            return shape ? (
                              <>
                                <span className="flex w-16 h-16 sm:w-20 sm:h-20 shrink-0 items-center justify-center rounded-lg bg-white border border-[#e5e7eb] overflow-hidden p-1.5">
                                  <img
                                    src={shape.image}
                                    alt=""
                                    className="w-full h-full object-contain"
                                  />
                                </span>
                                <span className="truncate">{shape.label}</span>
                              </>
                            ) : (
                              <>
                                <span className="flex w-16 h-16 sm:w-20 sm:h-20 shrink-0 items-center justify-center rounded-lg bg-white border border-[#e5e7eb]" />
                                <span className="truncate capitalize">{leatherOutline}</span>
                              </>
                            );
                          })()
                        ) : (
                          <span className="text-[#888]">Choose outline</span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[10rem] sm:min-w-[12rem]">
                      {PATCH_SHAPES.map((shape) => (
                        <DropdownMenuItem
                          key={shape.value}
                          onSelect={() => setLeatherOutline(shape.value)}
                        >
                          <span className="flex w-16 h-16 sm:w-20 sm:h-20 shrink-0 items-center justify-center rounded-lg bg-white border border-[#e5e7eb] overflow-hidden p-1.5">
                            <img
                              src={shape.image}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          </span>
                          <span>{shape.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div>
                  <p className="text-xs text-[#4b5563] mb-1.5">Leatherette color</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-[#d1d5db] bg-white text-[#111827] flex items-center gap-3 min-h-14 sm:min-h-16 hover:bg-[#f9fafb]"
                      >
                        {leatherColor ? (
                          (() => {
                            const option = LEATHER_COLORS.find(
                              (c) => c.value === leatherColor
                            );
                            return option ? (
                              <>
                                <span className="flex w-16 h-16 sm:w-20 sm:h-20 shrink-0 items-center justify-center rounded-lg bg-white border border-[#e5e7eb] overflow-hidden">
                                  <img
                                    src={option.image}
                                    alt={option.label}
                                    className="w-full h-full object-cover"
                                  />
                                </span>
                                <span className="truncate">{option.label}</span>
                              </>
                            ) : (
                              <>
                                <span className="flex w-16 h-16 sm:w-20 sm:h-20 shrink-0 items-center justify-center rounded-lg bg-white border border-[#e5e7eb] overflow-hidden">
                                  <span className="w-full h-full flex">
                                    <span className="w-1/2 h-full bg-[#e5b27b]" />
                                    <span className="w-1/2 h-full bg-black" />
                                  </span>
                                </span>
                                <span className="truncate">{leatherColor}</span>
                              </>
                            );
                          })()
                        ) : (
                          <span className="text-[#888]">Choose color</span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[10rem] sm:min-w-[12rem]">
                      {LEATHER_COLORS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onSelect={() => setLeatherColor(option.value)}
                        >
                          <span className="flex w-16 h-16 sm:w-20 sm:h-20 shrink-0 items-center justify-center rounded-lg bg-white border border-[#e5e7eb] overflow-hidden">
                            <img
                              src={option.image}
                              alt={option.label}
                              className="w-full h-full object-cover"
                            />
                          </span>
                          <span>{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="mt-4 border border-[#e5e7eb] bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#d1d5db]">
                  <th className="text-left font-medium text-[#374151] px-3 py-2.5 border-r border-[#d1d5db]">
                    Buy quantity
                  </th>
                  <th className="text-right font-medium text-[#374151] px-3 py-2.5">
                    Discounted rate
                  </th>
                </tr>
              </thead>
              <tbody className="text-[#4b5563]">
                <tr className="border-b border-[#d1d5db]">
                  <td className="px-3 py-2 border-r border-[#d1d5db]">Buy 12 – 23</td>
                  <td className="px-3 py-2 text-right">$20.00 each</td>
                </tr>
                <tr className="border-b border-[#d1d5db]">
                  <td className="px-3 py-2 border-r border-[#d1d5db]">Buy 24 – 47</td>
                  <td className="px-3 py-2 text-right">$18.00 each</td>
                </tr>
                <tr className="border-b border-[#d1d5db]">
                  <td className="px-3 py-2 border-r border-[#d1d5db]">Buy 48 – 95</td>
                  <td className="px-3 py-2 text-right">$16.00 each</td>
                </tr>
                <tr className="border-b border-[#d1d5db]">
                  <td className="px-3 py-2 border-r border-[#d1d5db]">Buy 96 – 143</td>
                  <td className="px-3 py-2 text-right">$15.00 each</td>
                </tr>
                <tr className="border-b border-[#d1d5db]">
                  <td className="px-3 py-2 border-r border-[#d1d5db]">Buy 144+</td>
                  <td className="px-3 py-2 text-right">$14.00 each</td>
                </tr>
              </tbody>
            </table>
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
          <div className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 space-y-1.5">
            <p className="text-xs uppercase tracking-[0.08em] text-[#6b7280] mb-2">
              Estimated total
            </p>
            <p className="text-sm text-[#374151]">
              {qty} × {currencyCode} {unitPrice.toFixed(2)}
              {locationMultiplier >= 2 ? " × 2 (front + side)" : ""} = {currencyCode} {calculatedTotal.subtotal.toFixed(2)}
            </p>
            <p className="text-sm text-[#6b7280]">
              +{currencyCode} {SETUP_FEE} setup fee [new users only]
            </p>
            <p className="text-base font-medium text-[#111827] pt-1 border-t border-[#e5e7eb]">
              Total: {currencyCode} {calculatedTotal.total.toFixed(2)}
            </p>
          </div>
        )}
        <label className="text-sm text-[#374151]">
          <span className="block mb-1.5 text-[#374151]">Note (optional)</span>
          <p className="text-xs text-[#4b5563] mb-1.5">
            Please be specific: include any details that help us fulfill your order—e.g. design placement, colors, thread or patch preferences, personalization text, and requested timeline or deadline.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Center the logo on the front, use navy thread, need by March 15…"
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
