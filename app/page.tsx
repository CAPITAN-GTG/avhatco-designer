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
      <main className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] w-full px-4 sm:px-6 py-6">
        <h1 className="text-xl font-semibold mb-4">Shopify products</h1>
        <p className="text-red-600 mb-2">{error}</p>
        <p className="text-sm text-[#555]">
          Admin API: set SHOPIFY_STORE plus either (a) SHOPIFY_ADMIN_ACCESS_TOKEN, or
          (b) CLIENT_ID and CLIENT_SECRET (or SECRET_KEY) from Dev Dashboard → your app → Settings.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] w-full">
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl font-semibold">Custom designer</h1>
          <p className="text-sm text-[#555] mt-1">
            Upload your artwork, preview it on the product, then submit your request.
          </p>
        </div>

        {products.length === 0 && (
          <p className="text-sm text-[#555] mb-4 sm:mb-6">
            No products. Store may be empty or token may lack scope.
          </p>
        )}

        <DesignerCard products={products} />
      </div>
    </main>
  );
}
