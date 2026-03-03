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
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mb-4">Shopify products</h1>
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
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <header className="mb-6 sm:mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6b7280]">
            Avhatco Designer
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">
            Custom hat request
          </h1>
          <p className="text-sm sm:text-base text-[#4b5563] mt-2 max-w-2xl">
            Upload your artwork, preview it on the product, then submit your request.
          </p>
        </header>

        {products.length === 0 && (
          <div className="mb-6 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm text-[#4b5563]">
            No products found. The store may be empty or token may lack scope.
          </div>
        )}

        <DesignerCard products={products} />
      </div>
    </main>
  );
}
