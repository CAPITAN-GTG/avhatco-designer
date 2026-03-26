"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "react-toastify";
import { sendOrderEmailsAfterPayment } from "../actions/sendOrderEmails";
import type { SendOrderEmailsInput } from "../actions/sendOrderEmails";
import {
  computeOrderTotal,
  MIN_QUANTITY,
  SETUP_FEE,
} from "@/lib/pricing";
import {
  DEFAULT_LEATHER_COLOR,
  DEFAULT_LEATHER_OUTLINE,
  LEATHER_COLORS,
  PATCH_SHAPES,
  leatherPatchTextureSrc,
  type DecorationType,
} from "@/lib/decoration";
import type { ShopifyProduct } from "../lib/shopify";
import { PAID_ORDER_PENDING_KEY, StripeCheckoutModal } from "./StripeCheckout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { DropZone } from "./designer/DropZone";

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
    <DropdownMenuItem
      onSelect={onSelect}
      textValue={product.title}
      className="!gap-3 text-zinc-100 focus:!bg-zinc-700 data-[highlighted]:!bg-zinc-700 focus:!text-white data-[highlighted]:!text-white"
    >
      <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-md overflow-hidden bg-zinc-800 border border-zinc-600">
        {product.featuredImage?.url ? (
          <img
            src={product.featuredImage.url}
            alt={product.featuredImage.altText ?? product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-zinc-400">—</span>
        )}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="truncate text-zinc-100">{product.title}</span>
        <span className="text-xs text-zinc-400">{price}</span>
      </span>
    </DropdownMenuItem>
  );
}

/** Match Tailwind `md` (mobile / small tablet pickers use a bottom sheet). */
function useMaxMd() {
  const [maxMd, setMaxMd] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMaxMd(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return maxMd;
}

const leatherTriggerBtnClass =
  "group w-full flex flex-col overflow-hidden rounded-none border-y border-zinc-700 bg-zinc-900/50 p-0 text-left text-zinc-100 shadow-sm shadow-black/20 transition-colors duration-200 hover:border-zinc-500 hover:bg-zinc-700/85 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/45 sm:rounded-lg sm:border sm:border-zinc-700";

function LeatherOutlinePicker({
  mobile,
  leatherOutlineResolved,
  leatherColorResolved,
  dieCutShapeUrl,
  onLeatherOutlineChange,
}: {
  mobile: boolean;
  leatherOutlineResolved: string;
  leatherColorResolved: string;
  /** User-uploaded die-cut outline image; used as the thumbnail when die cut is selected. */
  dieCutShapeUrl?: string | null;
  onLeatherOutlineChange: (value: string | null) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const shape = PATCH_SHAPES.find((s) => s.value === leatherOutlineResolved);
  const thumb =
    shape &&
    (leatherOutlineResolved === "die cut" && dieCutShapeUrl
      ? dieCutShapeUrl
      : (leatherPatchTextureSrc(leatherOutlineResolved, leatherColorResolved) ?? shape.image));

  const triggerInner =
    shape && thumb ? (
      <>
        <div className="relative aspect-[4/3] w-full min-h-[148px] bg-zinc-800/80 sm:min-h-[168px]">
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 h-full w-full object-contain mix-blend-plus-lighter opacity-95"
          />
        </div>
        <span className="block w-full border-t border-zinc-700 bg-zinc-900/80 px-2 py-2.5 text-center text-xs font-medium text-zinc-100">
          {shape.label}
        </span>
      </>
    ) : (
      <span className="flex min-h-[120px] items-center justify-center px-3 py-6 text-sm text-zinc-400">
        Choose outline
      </span>
    );

  const sheet = (
    <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
      <DialogContent
        overlayClassName="leather-sheet-overlay"
        className={
          "leather-sheet-content flex max-h-[min(88dvh,720px)] w-full max-w-none flex-col gap-0 overflow-hidden !rounded-b-none !rounded-t-2xl border border-zinc-700 bg-zinc-950 !p-0 shadow-2xl shadow-black/50 " +
          "!fixed !bottom-0 !left-0 !right-0 !top-auto !h-auto !translate-x-0 !translate-y-0"
        }
      >
        <DialogDescription className="sr-only">
          Choose a patch outline. Scroll the list and tap an option to select it.
        </DialogDescription>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
          <DialogTitle className="text-base font-medium tracking-tight text-zinc-100">
            Patch outline
          </DialogTitle>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-700/90 hover:text-white"
            onClick={() => setSheetOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-zinc-950 px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PATCH_SHAPES.map((s) => {
              const t =
                s.value === "die cut" && dieCutShapeUrl
                  ? dieCutShapeUrl
                  : (leatherPatchTextureSrc(s.value, leatherColorResolved) ?? s.image);
              return (
                <button
                  key={s.value}
                  type="button"
                  className="flex flex-col overflow-hidden rounded-xl border border-zinc-600 bg-zinc-900/80 text-left text-zinc-100 shadow-md shadow-black/30 transition-colors duration-200 hover:border-sky-500/45 hover:bg-zinc-800/95 active:bg-zinc-700"
                  onClick={() => {
                    onLeatherOutlineChange(s.value);
                    setSheetOpen(false);
                  }}
                >
                  <div className="relative aspect-[4/3] w-full min-h-[72px] max-h-[92px] bg-zinc-800/90">
                    <img
                      src={t}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain mix-blend-plus-lighter opacity-95"
                    />
                  </div>
                  <span className="border-t border-zinc-600 px-1 py-1.5 text-center text-[10px] font-medium leading-snug text-zinc-100">
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (mobile) {
    return (
      <>
        <button
          type="button"
          className={leatherTriggerBtnClass}
          onClick={() => setSheetOpen(true)}
        >
          {triggerInner}
        </button>
        {sheet}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={leatherTriggerBtnClass}>
          {triggerInner}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="leather-dropdown-content max-h-[min(22rem,min(70dvh,calc(100dvh-6rem)))] !w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg !border-zinc-700 !bg-zinc-950 !p-1 !text-zinc-100 shadow-xl shadow-black/40"
      >
        {PATCH_SHAPES.map((s) => {
          const t =
            s.value === "die cut" && dieCutShapeUrl
              ? dieCutShapeUrl
              : (leatherPatchTextureSrc(s.value, leatherColorResolved) ?? s.image);
          return (
            <DropdownMenuItem
              key={s.value}
              onSelect={() => onLeatherOutlineChange(s.value)}
              className="!m-0 !flex !h-auto cursor-pointer !flex-row !items-center !gap-3 !rounded-md !px-2 !py-2 text-zinc-100 focus:!bg-zinc-700 data-[highlighted]:!bg-zinc-700 focus:!text-white data-[highlighted]:!text-white"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-800 border border-zinc-600/80">
                <img
                  src={t}
                  alt=""
                  className="h-full w-full object-contain mix-blend-plus-lighter opacity-95"
                />
              </div>
              <span className="min-w-0 flex-1 text-left text-sm text-zinc-100">{s.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LeatherColorPicker({
  mobile,
  leatherColorResolved,
  onLeatherColorChange,
}: {
  mobile: boolean;
  leatherColorResolved: string;
  onLeatherColorChange: (value: string | null) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const option = LEATHER_COLORS.find((c) => c.value === leatherColorResolved);

  const triggerInner =
    leatherColorResolved && option ? (
      <>
        <div className="relative aspect-[4/3] w-full min-h-[148px] bg-zinc-800/80 sm:min-h-[168px]">
          <img
            src={option.image}
            alt={option.label}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <span className="block w-full border-t border-zinc-700 bg-zinc-900/80 px-2 py-2.5 text-center text-xs font-medium text-zinc-100">
          {option.label}
        </span>
      </>
    ) : leatherColorResolved && !option ? (
      <>
        <div className="relative aspect-[4/3] w-full min-h-[148px] bg-zinc-800/80 sm:min-h-[168px]">
          <span className="absolute inset-0 flex">
            <span className="h-full w-1/2 bg-[#e5b27b]" />
            <span className="h-full w-1/2 bg-zinc-950" />
          </span>
        </div>
        <span className="block w-full border-t border-zinc-700 bg-zinc-900/80 px-2 py-2.5 text-center text-xs font-medium text-zinc-100">
          {leatherColorResolved}
        </span>
      </>
    ) : (
      <span className="flex min-h-[120px] items-center justify-center px-3 py-6 text-sm text-zinc-400">
        Choose color
      </span>
    );

  const sheet = (
    <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
      <DialogContent
        overlayClassName="leather-sheet-overlay"
        className={
          "leather-sheet-content flex max-h-[min(88dvh,720px)] w-full max-w-none flex-col gap-0 overflow-hidden !rounded-b-none !rounded-t-2xl border border-zinc-700 bg-zinc-950 !p-0 shadow-2xl shadow-black/50 " +
          "!fixed !bottom-0 !left-0 !right-0 !top-auto !h-auto !translate-x-0 !translate-y-0"
        }
      >
        <DialogDescription className="sr-only">
          Choose a leatherette material color. Scroll the list and tap an option to select it.
        </DialogDescription>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
          <DialogTitle className="text-base font-medium tracking-tight text-zinc-100">
            Leatherette color
          </DialogTitle>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-700/90 hover:text-white"
            onClick={() => setSheetOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-zinc-950 px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LEATHER_COLORS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-600 bg-zinc-900/80 text-left text-zinc-100 shadow-md shadow-black/30 transition-colors duration-200 hover:border-sky-500/45 hover:bg-zinc-800/95 active:bg-zinc-700"
                onClick={() => {
                  onLeatherColorChange(opt.value);
                  setSheetOpen(false);
                }}
              >
                <div className="relative aspect-[4/3] w-full min-h-[72px] max-h-[92px] bg-zinc-800/90">
                  <img
                    src={opt.image}
                    alt={opt.label}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <span className="border-t border-zinc-600 px-1 py-1.5 text-center text-[10px] font-medium leading-snug text-zinc-100">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (mobile) {
    return (
      <>
        <button
          type="button"
          className={leatherTriggerBtnClass}
          onClick={() => setSheetOpen(true)}
        >
          {triggerInner}
        </button>
        {sheet}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={leatherTriggerBtnClass}>
          {triggerInner}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="leather-dropdown-content max-h-[min(22rem,min(70dvh,calc(100dvh-6rem)))] !w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg !border-zinc-700 !bg-zinc-950 !p-1 !text-zinc-100 shadow-xl shadow-black/40"
      >
        {LEATHER_COLORS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onLeatherColorChange(opt.value)}
            className="!m-0 !flex !h-auto cursor-pointer !flex-row !items-center !gap-3 !rounded-md !px-2 !py-2 text-zinc-100 focus:!bg-zinc-700 data-[highlighted]:!bg-zinc-700 focus:!text-white data-[highlighted]:!text-white"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-800 border border-zinc-600/80">
              <img
                src={opt.image}
                alt={opt.label}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="min-w-0 flex-1 text-left text-sm text-zinc-100">{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function OrderForm({
  products,
  productId,
  setProductId,
  getPreviewImages,
  locations = 0,
  decorationType,
  onDecorationTypeChange,
  leatherOutline,
  onLeatherOutlineChange,
  leatherColor,
  onLeatherColorChange,
  dieCutShapeUrl,
  onDieCutShapeFile,
}: {
  products: ShopifyProduct[];
  productId: string;
  setProductId: (id: string) => void;
  getPreviewImages?: () => Promise<{
    front?: string;
    side?: string;
    frontDesignOnly?: string;
    sideDesignOnly?: string;
    dieCutShapeHighResDataUrl?: string;
  }>;
  locations?: number;
  decorationType: DecorationType;
  onDecorationTypeChange: (value: DecorationType) => void;
  leatherOutline: string | null;
  onLeatherOutlineChange: (value: string | null) => void;
  leatherColor: string | null;
  onLeatherColorChange: (value: string | null) => void;
  dieCutShapeUrl: string | null;
  onDieCutShapeFile: (file: File | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState<string>(String(MIN_QUANTITY));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPayload, setOrderPayload] = useState<SendOrderEmailsInput | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const leatherPickerMobile = useMaxMd();

  useEffect(() => {
    const url = new URL(window.location.href);
    const pi = url.searchParams.get("payment_intent");
    const rs = url.searchParams.get("redirect_status");
    if (!pi || rs !== "succeeded") return;
    const raw = sessionStorage.getItem(PAID_ORDER_PENDING_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PAID_ORDER_PENDING_KEY);
    const next = new URL(window.location.href);
    next.searchParams.delete("payment_intent");
    next.searchParams.delete("payment_intent_client_secret");
    next.searchParams.delete("redirect_status");
    const clean =
      next.pathname + (next.searchParams.toString() ? `?${next.searchParams}` : "") + next.hash;
    window.history.replaceState({}, "", clean);

    void (async () => {
      try {
        const pending = JSON.parse(raw) as SendOrderEmailsInput & { currencyCode: string };
        const result = await sendOrderEmailsAfterPayment({
          ...pending,
          paymentIntentId: pi,
        });
        if (result.success) {
          toast.success("Payment successful. Order confirmation sent.");
          setStatus("ok");
          setMessage("Order placed. Check your inbox and the business inbox.");
        } else {
          toast.error(result.error);
          setStatus("error");
          setMessage(result.error);
        }
      } catch {
        toast.error("Could not complete your order after payment. Please contact support.");
        setStatus("error");
        setMessage("Could not send order after payment. Please contact support.");
      }
    })();
  }, []);

  async function handlePayAndOrder(e: React.FormEvent) {
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

    setStatus("idle");
    setMessage("");
    const { currencyCode } = product.priceRange.minVariantPrice;
    const { total, unitPrice } = computeOrderTotal(qty, locations, decorationType);
    const priceStr = `${currencyCode} ${unitPrice.toFixed(2)}`;
    const totalStr = `${currencyCode} ${total.toFixed(2)}`;
    setCheckoutBusy(true);
    const previewImages: {
      front?: string;
      side?: string;
      frontDesignOnly?: string;
      sideDesignOnly?: string;
      dieCutShapeHighResDataUrl?: string;
    } = (await getPreviewImages?.().catch(() => ({}))) ?? {};
    setCheckoutBusy(false);
    const hasDesign =
      decorationType === "leather"
        ? Boolean(previewImages.frontDesignOnly)
        : Boolean(previewImages.front || previewImages.side);
    if (!hasDesign) {
      setStatus("error");
      setMessage(
        decorationType === "leather"
          ? "Please upload a front design image for your leatherette patch."
          : "Please upload at least one design image (front or side)"
      );
      return;
    }
    const resolvedOutline =
      decorationType === "leather" ? leatherOutline ?? DEFAULT_LEATHER_OUTLINE : null;
    if (
      decorationType === "leather" &&
      resolvedOutline === "die cut" &&
      !previewImages.dieCutShapeHighResDataUrl
    ) {
      setStatus("error");
      setMessage("Please upload a die-cut patch shape image (the outline your patch should follow).");
      return;
    }
    setOrderPayload({
      customerEmail: email.trim(),
      phone: phoneDigits ? formatPhone(phone) : undefined,
      productId: product.id,
      productTitle: product.title,
      productPrice: priceStr,
      quantity: qty,
      totalPrice: totalStr,
      note: note.trim() || undefined,
      locationsCount:
        decorationType === "leather" ? (previewImages.frontDesignOnly ? 1 : 0) : locations,
      decorationType,
      leatherOutline:
        decorationType === "leather"
          ? leatherOutline ?? DEFAULT_LEATHER_OUTLINE
          : undefined,
      leatherColor:
        decorationType === "leather"
          ? leatherColor ?? DEFAULT_LEATHER_COLOR
          : undefined,
      frontImageDataUrl: previewImages?.front,
      sideImageDataUrl: previewImages?.side,
      frontDesignOnlyDataUrl: previewImages?.frontDesignOnly,
      sideDesignOnlyDataUrl: previewImages?.sideDesignOnly,
      dieCutShapeHighResDataUrl: previewImages?.dieCutShapeHighResDataUrl,
    });
    setCheckoutOpen(true);
  }

  if (products.length === 0) return null;

  const selectedProduct = productId ? products.find((x) => x.id === productId) : null;
  const qty =
    quantity === "" || quantity === null || Number(quantity) === 0 || Number.isNaN(Number(quantity))
      ? MIN_QUANTITY
      : Math.max(MIN_QUANTITY, Math.floor(Number(quantity)));
  const currencyCode = selectedProduct?.priceRange.minVariantPrice.currencyCode ?? "USD";
  const pricing = selectedProduct
    ? computeOrderTotal(qty, locations, decorationType)
    : null;
  const locationMultiplier =
    decorationType === "leather" ? 1 : locations >= 2 ? 2 : 1;
  const calculatedTotal =
    selectedProduct && pricing
      ? { currencyCode, subtotal: pricing.subtotal, total: pricing.total, unitPrice: pricing.unitPrice }
      : null;

  const leatherColorResolved = leatherColor ?? DEFAULT_LEATHER_COLOR;
  const leatherOutlineResolved = leatherOutline ?? DEFAULT_LEATHER_OUTLINE;

  const fieldClass =
    "w-full text-sm px-3 py-2.5 rounded-lg border border-zinc-600 bg-zinc-950/70 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-500/60";

  return (
    <div className="w-full xl:sticky xl:top-8">
      <h2 className="text-base sm:text-lg font-medium tracking-tight text-white">
        Order details
      </h2>
      <p className="text-xs sm:text-sm text-zinc-400 mt-1 mb-5 leading-snug">
        Pick a product, then pay securely. We email your order only after payment succeeds.
      </p>
      <form
        onSubmit={handlePayAndOrder}
        className="flex flex-col gap-5 w-full text-zinc-100"
      >
        <section className="space-y-2" aria-labelledby="order-section-product">
          <h3
            id="order-section-product"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
          >
            Product
          </h3>
          <label className="text-sm text-zinc-300">
            <span className="sr-only">Select product</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-zinc-600 bg-zinc-900/70 text-zinc-50 flex items-center gap-2.5 min-h-10 transition-colors duration-200 hover:border-sky-500/40 hover:bg-zinc-700/90 hover:text-white"
                >
                  {selectedProduct ? (
                    <>
                      <span className="flex w-9 h-9 shrink-0 rounded-md overflow-hidden bg-zinc-800 border border-zinc-600">
                        {selectedProduct.featuredImage?.url ? (
                          <img
                            src={selectedProduct.featuredImage.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">
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
                    <span className="text-zinc-400">— Choose one —</span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[16rem] sm:min-w-[18rem] !border-zinc-700 !bg-zinc-950 !text-zinc-100 shadow-xl shadow-black/40"
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
          {decorationType === "leather" && (
            <p className="text-[11px] leading-snug text-red-400/90 mt-2">
              Products will not display when leatherette patches are selected
            </p>
          )}
        </section>

        <section className="space-y-2" aria-labelledby="order-section-decoration">
          <h3
            id="order-section-decoration"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
          >
            Decoration
          </h3>
          <p className="text-xs text-zinc-400 -mt-0.5">
            Embroidery or leatherette patch. We do not offer DTF.
          </p>
          <div className="rounded-xl border border-zinc-600 bg-zinc-900/60 overflow-hidden shadow-lg shadow-black/25">
            <Tabs
              value={decorationType}
              onValueChange={(value) => {
                const next = (value as DecorationType) ?? "embroidery";
                onDecorationTypeChange(next);
              }}
              className="w-full"
            >
              <div className="flex w-full border-b border-zinc-600 bg-zinc-950/40">
                <TabsList
                  variant="line"
                  className="w-full h-auto flex-1 rounded-none gap-0 p-0 bg-transparent border-0"
                >
                  <TabsTrigger
                    value="embroidery"
                    className="flex-1 rounded-none rounded-tl-xl border-0 border-r border-zinc-600 py-2.5 after:hidden data-[state=active]:border-r data-[state=active]:border-zinc-600"
                  >
                    Embroidery
                  </TabsTrigger>
                  <TabsTrigger
                    value="leather"
                    className="flex-1 rounded-none rounded-tr-xl border-0 py-2.5 after:hidden"
                  >
                    Leatherette patch
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="embroidery" className="px-3 py-3 sm:px-4 text-zinc-300">
                <p className="text-sm leading-snug text-zinc-300">
                  Your design will be embroidered on the hat. Use the front and side previews as
                  needed.
                </p>
              </TabsContent>
              <TabsContent value="leather" className="px-0 py-3 outline-none text-zinc-300">
                <p className="mb-3 px-3 text-[11px] leading-snug text-zinc-400">
                  {leatherPickerMobile
                    ? "Tap to open a scrollable sheet. You can close it to review the rest of the form."
                    : "Tap to open a compact list. Images are edge-to-edge on the selected preview above."}
                </p>
                <div className="flex flex-col gap-6">
                  <div className="min-w-0">
                    <p className="mb-2 px-3 text-xs font-medium text-zinc-300">Patch outline</p>
                    <LeatherOutlinePicker
                      mobile={leatherPickerMobile}
                      leatherOutlineResolved={leatherOutlineResolved}
                      leatherColorResolved={leatherColorResolved}
                      dieCutShapeUrl={dieCutShapeUrl}
                      onLeatherOutlineChange={onLeatherOutlineChange}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 px-3 text-xs font-medium text-zinc-300">Leatherette color</p>
                    <LeatherColorPicker
                      mobile={leatherPickerMobile}
                      leatherColorResolved={leatherColorResolved}
                      onLeatherColorChange={onLeatherColorChange}
                    />
                  </div>
                  {leatherOutlineResolved === "die cut" && (
                    <div className="min-w-0 border-t border-zinc-700/80 pt-4 mt-1">
                      <p className="mb-1.5 px-3 text-xs font-medium text-zinc-300">
                        Die-cut patch shape
                      </p>
                      <p className="mb-2 px-3 text-[11px] leading-snug text-zinc-500">
                        Upload the image that defines the cut outline. It appears behind your artwork on
                        the preview (leatherette color still applies).
                      </p>
                      <p className="mb-3 px-3 text-[11px] leading-snug font-medium text-red-400">
                        Use a PNG with no background—transparent areas show as leather brown in the
                        preview; do not submit a white or solid-color backdrop behind the shape.
                      </p>
                      <div className="px-3">
                        <DropZone
                          label={
                            dieCutShapeUrl
                              ? "Drop another image to replace shape"
                              : "Drop shape image (PNG or JPG)"
                          }
                          onFile={(file) => onDieCutShapeFile(file)}
                        />
                        {dieCutShapeUrl ? (
                          <button
                            type="button"
                            onClick={() => onDieCutShapeFile(null)}
                            className="mt-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
                          >
                            Remove shape image
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="order-section-pricing">
          <h3
            id="order-section-pricing"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
          >
            Quantity discounts
          </h3>
          <div className="rounded-xl border border-zinc-600 bg-zinc-900/50 overflow-hidden shadow-md shadow-black/20">
            <p className="text-xs text-zinc-400 px-3 pt-2.5 pb-1 border-b border-zinc-700/90">
              {decorationType === "leather"
                ? "Leatherette patch per-unit pricing"
                : "Embroidery per-unit pricing"}
            </p>
            <table className="w-full text-sm text-zinc-300 border-collapse">
              <thead>
                <tr className="border-b border-zinc-600 bg-zinc-950/35">
                  <th className="text-left font-medium text-zinc-300 px-3 py-2.5 border-r border-zinc-600">
                    Buy quantity
                  </th>
                  <th className="text-right font-medium text-zinc-300 px-3 py-2.5">
                    Discounted rate
                  </th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {decorationType === "leather" ? (
                  <>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 12 – 23</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$22.00 each</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 24 – 47</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$20.00 each</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 48 – 95</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$18.00 each</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 96 – 143</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$17.00 each</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 144+</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$15.00 each</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 12 – 23</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$20.00 each</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 24 – 47</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$18.00 each</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 48 – 95</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$16.00 each</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 96 – 143</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$15.00 each</td>
                    </tr>
                    <tr className="border-b border-zinc-800">
                      <td className="px-3 py-2 border-r border-zinc-800 text-zinc-300">Buy 144+</td>
                      <td className="px-3 py-2 text-right text-zinc-200">$14.00 each</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="order-section-contact">
          <h3
            id="order-section-contact"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
          >
            Your order
          </h3>
          <label className="text-sm text-zinc-300 block">
            <span className="block mb-1.5 text-zinc-300">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={fieldClass}
            />
          </label>
          <label className="text-sm text-zinc-300 block">
            <span className="block mb-1.5 text-zinc-300">Phone (optional)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(555) 123-4567"
              className={fieldClass}
            />
          </label>
          <label className="text-sm text-zinc-300 block">
            <span className="block mb-1.5 text-zinc-300">Quantity</span>
            <input
              type="number"
              min={MIN_QUANTITY}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={() => {
                const n = Number(quantity);
                if (quantity === "" || Number.isNaN(n) || n < MIN_QUANTITY) setQuantity(String(MIN_QUANTITY));
              }}
              className={fieldClass}
            />
            <p className="text-xs text-zinc-400 mt-1.5 leading-snug">
              Minimum {MIN_QUANTITY} units for production efficiency and consistent quality.
            </p>
          </label>
          <label className="text-sm text-zinc-300 block">
            <span className="block mb-1.5 text-zinc-300">Notes (optional)</span>
            <p className="text-xs text-zinc-400 mb-1.5 leading-snug">
              Placement, colors, thread or patch preferences, personalization, deadlines.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Center the logo on the front, use navy thread, need by March 15…"
              rows={3}
              className={`${fieldClass} resize-y`}
            />
          </label>
        </section>

        {calculatedTotal != null && (
          <div className="rounded-xl border border-zinc-600 bg-zinc-900/55 px-3 py-3 space-y-1.5 shadow-inner shadow-black/20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Estimated total
            </p>
            <p className="text-sm text-zinc-300">
              {qty} × {currencyCode} {calculatedTotal.unitPrice.toFixed(2)}
              {locationMultiplier >= 2 ? " × 2 (front + side)" : ""} = {currencyCode}{" "}
              {calculatedTotal.subtotal.toFixed(2)}
            </p>
            <p className="text-sm text-zinc-400">
              +{currencyCode} {SETUP_FEE} setup fee [new users only]
            </p>
            <p className="text-base font-semibold text-white pt-2 border-t border-zinc-600">
              Total: {currencyCode} {calculatedTotal.total.toFixed(2)}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={checkoutBusy}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-400/25 bg-neutral-200 px-4 py-3.5 text-sm font-semibold tracking-wide text-neutral-950 shadow-sm transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-50 font-[family-name:var(--font-poppins)]"
        >
          {checkoutBusy ? (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-700" aria-hidden />
              <span>Preparing secure checkout…</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 shrink-0 text-neutral-700" aria-hidden />
              <span>Proceed to secure payment</span>
            </>
          )}
        </button>
      </form>
      <StripeCheckoutModal
        open={checkoutOpen}
        onOpenChange={(o) => {
          setCheckoutOpen(o);
          if (!o) setOrderPayload(null);
        }}
        quantity={quantity}
        locations={locations}
        decorationType={decorationType}
        currencyCode={currencyCode}
        orderPayload={orderPayload}
        onOrderComplete={() => {
          toast.success("Payment successful. Order confirmation sent.");
          setStatus("ok");
          setMessage("Order placed. Check your inbox and the business inbox.");
        }}
      />
      {status === "ok" && (
        <p className="text-sm text-emerald-200 mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/55 px-3 py-2.5">
          {message}
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-200 mt-3 rounded-lg border border-red-800/55 bg-red-950/50 px-3 py-2.5">
          {message}
        </p>
      )}
    </div>
  );
}
