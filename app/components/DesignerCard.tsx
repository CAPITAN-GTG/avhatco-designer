"use client";

import { useRef, useCallback } from "react";
import ImageOverlaySection, {
  type ImageOverlaySectionHandle,
} from "./ImageOverlaySection";
import OrderForm from "./OrderForm";
import type { ShopifyProduct } from "../lib/shopify";

export default function DesignerCard({
  products,
}: {
  products: ShopifyProduct[];
}) {
  const overlaySectionRef = useRef<ImageOverlaySectionHandle>(null);

  const getPreviewImages = useCallback(async () => {
    return overlaySectionRef.current?.getCompositedImages() ?? {};
  }, []);

  return (
    <div className="rounded-xl bg-white border border-[#e5e5e5] shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <ImageOverlaySection ref={overlaySectionRef} />
        </div>

        <div className="border-t border-[#e5e5e5] lg:border-t-0 lg:border-l lg:w-[420px] shrink-0 p-4 sm:p-6 bg-white">
          <OrderForm products={products} getPreviewImages={getPreviewImages} />
        </div>
      </div>
    </div>
  );
}
