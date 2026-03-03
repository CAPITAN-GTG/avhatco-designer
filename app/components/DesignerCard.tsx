"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import ImageOverlaySection, {
  type ImageOverlaySectionHandle,
} from "./ImageOverlaySection";
import OrderForm from "./OrderForm";
import type { ShopifyProduct } from "../lib/shopify";

const IMAGE_CACHE_KEY = "designer_image_cache_v1";
const IMAGE_CACHE_DAYS = 7;

function productImages(product: ShopifyProduct | null): { front: string; side: string } | null {
  if (!product) return null;
  const front = product.images?.[0]?.url ?? product.featuredImage?.url;
  const side = product.images?.[1]?.url ?? product.images?.[0]?.url ?? product.featuredImage?.url;
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
  const selectedProduct = productId
    ? (products.find((p) => p.id === productId) ?? null)
    : null;
  const baseImages = productImages(selectedProduct);
  const imageUrls = useMemo(() => collectProductImageUrls(products), [products]);
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
    setLoadedCount(0);
    setTotalCount(imageUrls.length);

    const run = async () => {
      let loaded = 0;
      for (const url of imageUrls) {
        await preloadImage(url);
        loaded += 1;
        if (!cancelled) setLoadedCount(loaded);
      }
      if (cancelled) return;
      writeCookie(IMAGE_CACHE_KEY, imageSignature, IMAGE_CACHE_DAYS);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(IMAGE_CACHE_KEY, imageSignature);
      }
      setReady(true);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [imageUrls, imageSignature]);

  const progressPercent =
    totalCount > 0 ? Math.max(5, Math.round((loadedCount / totalCount) * 100)) : 100;

  if (!ready) {
    return (
      <div className="rounded-2xl bg-white border border-[#e5e7eb] overflow-hidden p-5 sm:p-7">
        <h2 className="text-base font-semibold tracking-tight text-[#111827]">Loading product images</h2>
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
    <div className="rounded-2xl bg-white border border-[#e5e7eb] overflow-hidden">
      <div className="flex flex-col xl:flex-row">
        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <ImageOverlaySection ref={overlaySectionRef} baseImages={baseImages} />
        </div>

        <div className="border-t border-[#e5e7eb] xl:border-t-0 xl:border-l xl:w-[420px] shrink-0 p-4 sm:p-6 lg:p-8 bg-[#fcfcfd]">
          <OrderForm
            products={products}
            productId={productId}
            setProductId={setProductId}
            getPreviewImages={getPreviewImages}
          />
        </div>
      </div>
    </div>
  );
}
