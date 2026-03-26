import { fetchAllShopifyProducts } from "./lib/shopify";
import DesignerCard from "./components/DesignerCard";

export default async function Home() {
  let products: Awaited<ReturnType<typeof fetchAllShopifyProducts>> = [];
  let error: string | null = null;

  try {
    products = await fetchAllShopifyProducts();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load data";
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f3f4f6] text-[#111827] w-full">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-8 lg:py-10">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8">
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight mb-4">Shopify products</h1>
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <p className="text-sm text-[#4b5563]">
              Admin API: set SHOPIFY_STORE plus either (a) SHOPIFY_ADMIN_ACCESS_TOKEN, or
              (b) CLIENT_ID and CLIENT_SECRET (or SECRET_KEY) from Dev Dashboard → your app → Settings.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
      <main className="min-h-screen bg-[#f3f4f6] text-[#111827] w-full">
        <div className="w-full max-w-[1600px] mx-auto px-0 sm:px-8 lg:px-12 py-6 sm:py-8 lg:py-10">
          <header className="mb-5 sm:mb-6 px-4 sm:px-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <a
              href="https://avhatco.com"
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#111827] rounded-lg hover:bg-[#1f2937] transition-colors shadow-sm"
            >
              <span aria-hidden className="text-base leading-none">←</span>
              Back to store
            </a>
            <div className="min-w-0 sm:border-l sm:border-[#e5e7eb] sm:pl-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
                Avhatco Designer
              </p>
              <h1 className="text-xl sm:text-2xl font-medium tracking-tight mt-0.5">
                Custom hat request
              </h1>
              <p className="text-sm text-[#4b5563] mt-1 max-w-xl">
                Upload artwork, preview placement, then pay to place your order.
              </p>
            </div>
          </div>
        </header>

        {products.length === 0 && (
          <div className="mb-6 mx-4 sm:mx-0 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#4b5563]">
            No products found. The store may be empty or token may lack scope.
          </div>
        )}

        <DesignerCard products={products} />
      </div>
    </main>
  );
}
