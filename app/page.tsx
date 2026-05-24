import { fetchAllShopifyProducts } from "./lib/shopify";
import DesignerCard from "./components/DesignerCard";
import { ArrowLeft } from "lucide-react";

export default async function Home() {
  let products: Awaited<ReturnType<typeof fetchAllShopifyProducts>> = [];
  let error: string | null = null;

  try {
    products = await fetchAllShopifyProducts();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load data";
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] text-[#111827] w-full">
      <div className="w-full px-0 sm:px-4 lg:px-6 py-3 sm:py-4">
        <header className="mb-3 sm:mb-4 px-4 sm:px-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <a
              href="https://avhatco.com"
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#111827] rounded-lg hover:bg-[#1f2937] transition-colors shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to store
            </a>
            <div className="min-w-0 sm:border-l sm:border-[#e5e7eb] sm:pl-4">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Avhatco Designer</h1>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-6 mx-4 sm:mx-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium mb-1">Could not load Shopify products</p>
            <p>{error}</p>
          </div>
        ) : null}

        {!error && products.length === 0 ? (
          <div className="mb-6 mx-4 sm:mx-0 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#4b5563]">
            No products found. The store may be empty or token may lack scope.
          </div>
        ) : null}

        <DesignerCard products={products} />
      </div>
    </main>
  );
}
