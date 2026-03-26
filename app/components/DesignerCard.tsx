"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import ImageOverlaySection, {
  type ImageOverlaySectionHandle,
} from "./ImageOverlaySection";
import OrderForm from "./OrderForm";
import type { ShopifyProduct } from "../lib/shopify";
import {
  DEFAULT_LEATHER_COLOR,
  DEFAULT_LEATHER_OUTLINE,
  LEATHER_PATCH_TEXTURE_URLS,
  PATCH_SHAPES,
  leatherPatchTextureSrc,
  type DecorationType,
} from "@/lib/decoration";
import { FALLBACK_BASE_IMAGES } from "./designer/overlayConstants";
import { toast } from "react-toastify";

const IMAGE_CACHE_KEY = "designer_image_cache_v1";
const IMAGE_CACHE_DAYS = 7;

/** Use product images 1–3: FRONT = 2nd image, SIDE = 3rd (fallback to 1st if no 3rd). */
function productImages(product: ShopifyProduct | null): { front: string; side: string } | null {
  if (!product) return null;
  const imgs = product.images ?? [];
  const front = imgs[1]?.url ?? imgs[0]?.url ?? product.featuredImage?.url;
  const side = imgs[2]?.url ?? imgs[0]?.url ?? product.featuredImage?.url;
  if (!front || !side) return null;
  return { front, side };
}

function collectProductImageUrls(products: ShopifyProduct[]): string[] {
  const urls = new Set<string>();
  for (const product of products) {
    if (product.featuredImage?.url) urls.add(product.featuredImage.url);
    for (const image of product.images ?? []) {
      if (image.url) urls.add(image.url);
    }
  }
  return [...urls];
}

/** First-paint: product photos + local fallbacks. Leather/shape assets load after. */
function criticalImageUrls(products: ShopifyProduct[]): string[] {
  const fromProducts = collectProductImageUrls(products);
  return [...new Set([...fromProducts, "/front.webp", "/side.webp"])];
}

function deferredDecorationAssetUrls(): string[] {
  return [
    ...new Set([
      ...LEATHER_PATCH_TEXTURE_URLS,
      ...PATCH_SHAPES.map((s) => s.image),
    ]),
  ];
}

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function isVectorFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "image/svg+xml" ||
    type === "application/svg+xml" ||
    name.endsWith(".svg") ||
    name.endsWith(".ai") ||
    name.endsWith(".eps") ||
    name.endsWith(".pdf")
  );
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export default function DesignerCard({
  products,
}: {
  products: ShopifyProduct[];
}) {
  const overlaySectionRef = useRef<ImageOverlaySectionHandle>(null);
  const [productId, setProductId] = useState("");
  const [ready, setReady] = useState(products.length === 0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [locationCount, setLocationCount] = useState(0);
  const [decorationType, setDecorationType] = useState<DecorationType>("embroidery");
  const [leatherOutline, setLeatherOutline] = useState<string | null>(
    DEFAULT_LEATHER_OUTLINE
  );
  const [leatherColor, setLeatherColor] = useState<string | null>(DEFAULT_LEATHER_COLOR);
  const [dieCutShapeUrl, setDieCutShapeUrl] = useState<string | null>(null);
  const [overlayResetKey, setOverlayResetKey] = useState(0);

  const setDieCutShapeFile = useCallback((file: File | null) => {
    if (!file) {
      setDieCutShapeUrl(null);
      return;
    }

    if (isVectorFile(file)) {
      void fileToDataUrl(file).then((dataUrl) => setDieCutShapeUrl(dataUrl));
      return;
    }

    void (async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Background removal failed");
        }

        const pngBlob = await res.blob();
        const pngDataUrl = await fileToDataUrl(pngBlob);
        setDieCutShapeUrl(pngDataUrl);
      } catch {
        toast.error("Could not remove background from the uploaded shape image.");
      }
    })();
  }, []);

  const leatherPatchImageSrc = useMemo(() => {
    if (decorationType !== "leather") return null;
    const outline = leatherOutline ?? DEFAULT_LEATHER_OUTLINE;
    // User's die-cut file replaces the generic custom-*.PNG layer entirely (no separate stock silhouette).
    if (outline === "die cut" && dieCutShapeUrl) {
      return null;
    }
    return leatherPatchTextureSrc(outline, leatherColor);
  }, [decorationType, leatherOutline, leatherColor, dieCutShapeUrl]);

  const handleDecorationTypeChange = useCallback((next: DecorationType) => {
    setDecorationType(next);
    if (next === "embroidery") {
      setLeatherOutline(null);
      setLeatherColor(DEFAULT_LEATHER_COLOR);
      setDieCutShapeUrl(null);
    }
    if (next === "leather") {
      setLeatherColor((c) => c ?? DEFAULT_LEATHER_COLOR);
      setLeatherOutline((o) => o ?? DEFAULT_LEATHER_OUTLINE);
    }
  }, []);

  const resetDesignerAfterSubmit = useCallback(() => {
    setProductId("");
    setDecorationType("embroidery");
    setLeatherOutline(DEFAULT_LEATHER_OUTLINE);
    setLeatherColor(DEFAULT_LEATHER_COLOR);
    setDieCutShapeUrl(null);
    setLocationCount(0);
    setOverlayResetKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (decorationType !== "leather" || leatherOutline !== "die cut") {
      setDieCutShapeUrl(null);
    }
  }, [decorationType, leatherOutline]);

  const selectedProduct = productId
    ? (products.find((p) => p.id === productId) ?? null)
    : null;
  const baseImages = productImages(selectedProduct);
  /** Leatherette alignment is tuned for the default hat; embroidery uses the selected product photos. */
  const previewBaseImages = useMemo(() => {
    if (decorationType === "leather") {
      return {
        front: FALLBACK_BASE_IMAGES.front,
        side: FALLBACK_BASE_IMAGES.side,
      };
    }
    return baseImages;
  }, [decorationType, baseImages]);
  const imageUrls = useMemo(() => {
    return [...new Set([...criticalImageUrls(products), ...deferredDecorationAssetUrls()])];
  }, [products]);
  const imageSignature = useMemo(() => hashText(imageUrls.join("|")), [imageUrls]);

  const getPreviewImages = useCallback(async () => {
    return overlaySectionRef.current?.getCompositedImages() ?? {};
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (imageUrls.length === 0) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    const cookieValue = readCookie(IMAGE_CACHE_KEY);
    const storageValue =
      typeof window !== "undefined" ? window.localStorage.getItem(IMAGE_CACHE_KEY) : null;
    const isWarm = cookieValue === imageSignature || storageValue === imageSignature;
    if (isWarm) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    setReady(false);
    const critical = criticalImageUrls(products);
    const deferred = deferredDecorationAssetUrls();
    setLoadedCount(0);
    setTotalCount(critical.length);

    const run = async () => {
      let done = 0;
      await Promise.all(
        critical.map(async (url) => {
          await preloadImage(url);
          done += 1;
          if (!cancelled) setLoadedCount(done);
        })
      );
      if (cancelled) return;
      setReady(true);
      await Promise.all(deferred.map((url) => preloadImage(url)));
      if (cancelled) return;
      writeCookie(IMAGE_CACHE_KEY, imageSignature, IMAGE_CACHE_DAYS);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(IMAGE_CACHE_KEY, imageSignature);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [imageUrls, imageSignature]);

  const progressPercent =
    totalCount > 0 ? Math.max(5, Math.round((loadedCount / totalCount) * 100)) : 100;

  if (!ready) {
    return (
      <div className="rounded-xl bg-white border border-[#e5e7eb] p-4 sm:p-5 max-w-lg">
        <h2 className="text-base font-medium tracking-tight text-[#111827]">Loading product images</h2>
        <p className="text-sm text-[#4b5563] mt-1">
          Preparing the designer for faster interactions.
        </p>
        <div className="mt-5 h-2 rounded-full bg-[#e5e7eb] overflow-hidden">
          <div
            className="h-full bg-[#111827] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-[#6b7280] mt-2">
          {loadedCount}/{totalCount} images loaded
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col xl:flex-row xl:items-stretch max-sm:rounded-none sm:rounded-xl sm:overflow-hidden sm:border sm:border-[#e5e7eb] xl:border xl:border-[#e5e7eb] xl:rounded-xl">
      <div className="min-w-0 flex-1 bg-white border border-[#e5e7eb] border-x-0 border-t-0 sm:border sm:border-[#e5e7eb] rounded-none sm:rounded-t-xl xl:rounded-t-none xl:rounded-l-xl xl:rounded-tr-none xl:border-r-0 p-4 sm:p-5 lg:p-6">
        <ImageOverlaySection
          key={overlayResetKey}
          ref={overlaySectionRef}
          baseImages={previewBaseImages}
          onLocationsChange={setLocationCount}
          decorationType={decorationType}
          leatherPatchImageSrc={leatherPatchImageSrc}
          leatherOutline={leatherOutline}
          dieCutShapeUrl={dieCutShapeUrl}
        />
      </div>

      <div className="w-full xl:w-[min(100%,380px)] xl:shrink-0 border border-zinc-700 border-x-0 border-t-0 sm:border sm:border-zinc-700 sm:border-t-0 xl:border-t rounded-none sm:rounded-b-xl xl:rounded-b-none xl:rounded-r-xl xl:rounded-tl-none bg-zinc-900 p-4 sm:p-5 lg:p-6 text-zinc-100 ring-1 ring-inset ring-white/[0.06]">
        <OrderForm
            products={products}
            productId={productId}
            setProductId={setProductId}
            getPreviewImages={getPreviewImages}
            locations={locationCount}
            decorationType={decorationType}
            onDecorationTypeChange={handleDecorationTypeChange}
            leatherOutline={leatherOutline}
            onLeatherOutlineChange={setLeatherOutline}
            leatherColor={leatherColor}
            onLeatherColorChange={setLeatherColor}
            dieCutShapeUrl={dieCutShapeUrl}
            onDieCutShapeFile={setDieCutShapeFile}
            onOrderSubmitted={resetDesignerAfterSubmit}
          />
      </div>
    </div>
  );
}
