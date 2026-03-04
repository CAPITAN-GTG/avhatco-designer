const SHOPIFY_STOREFRONT_API_VERSION = "2024-01";
const SHOPIFY_ADMIN_API_VERSION = "2025-01";

const FETCH_OPTIONS = { cache: "no-store" as RequestCache };

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  availableForSale: boolean;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  featuredImage?: { url: string; altText: string | null };
  /** Designer preview: 2nd image = front view, 3rd image = side view (API fetches first 3) */
  images?: { url: string; altText: string | null }[];
};

export type ShopifyCollection = {
  id: string;
  title: string;
  handle: string;
  description: string;
};

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          description
          vendor
          productType
          availableForSale
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          featuredImage { url altText }
          images(first: 3) {
            edges {
              node {
                url
                altText
              }
            }
          }
        }
      }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query GetCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          description
        }
      }
    }
  }
`;

type StorefrontProductNode = Omit<ShopifyProduct, "images"> & {
  images?: {
    edges: Array<{ node: { url: string; altText: string | null } }>;
  };
};

type ProductsResponse = {
  data?: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{
        node: StorefrontProductNode;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
};

function mapStorefrontProductNode(node: StorefrontProductNode): ShopifyProduct {
  const images = node.images?.edges?.slice(0, 3).map((e) => ({
    url: e.node.url,
    altText: e.node.altText ?? null,
  }));
  const firstImage = images?.[0];
  return {
    ...node,
    featuredImage: node.featuredImage ?? (firstImage ? { ...firstImage } : undefined),
    images: images?.length ? images : undefined,
  };
}

type CollectionsResponse = {
  data?: {
    collections: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{
        node: ShopifyCollection;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
};

// --- Admin API: token from env or from client credentials (Dev Dashboard apps) ---

let cachedAdminToken: string | null = null;
let cachedAdminTokenExpiresAt = 0;

async function getAdminAccessToken(): Promise<string> {
  const store = process.env.SHOPIFY_STORE?.trim();
  const staticToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (staticToken) return staticToken;

  const clientId = process.env.CLIENT_ID?.trim();
  const clientSecret = (
    process.env.CLIENT_SECRET ?? process.env.SECRET_KEY
  )?.trim();
  if (!store || !clientId || !clientSecret) {
    throw new Error(
      "For Admin API set SHOPIFY_ADMIN_ACCESS_TOKEN, or SHOPIFY_STORE + CLIENT_ID + CLIENT_SECRET (or SECRET_KEY). App must be installed on the store."
    );
  }

  if (cachedAdminToken && Date.now() < cachedAdminTokenExpiresAt - 60_000) {
    return cachedAdminToken;
  }

  const res = await fetch(
    `https://${store}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      ...FETCH_OPTIONS,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Client credentials failed (${res.status}). Install the app on the store and ensure app + store are in the same org. ${text.slice(0, 200)}`
    );
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedAdminToken = json.access_token;
  cachedAdminTokenExpiresAt = Date.now() + json.expires_in * 1000;
  return json.access_token;
}

const ADMIN_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          vendor
          productType
          status
          featuredImage { url altText }
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 50) {
            edges {
              node {
                price
                compareAtPrice
              }
            }
          }
        }
      }
    }
  }
`;

const ADMIN_COLLECTIONS_QUERY = `
  query GetCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          descriptionHtml
        }
      }
    }
  }
`;

type AdminProductNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  status: string;
  featuredImage?: { url: string; altText: string | null } | null;
  images?: {
    edges: Array<{
      node: { url: string; altText: string | null };
    }>;
  } | null;
  variants: {
    edges: Array<{
      node: { price: string; compareAtPrice?: string | null };
    }>;
  };
};

type AdminCollectionNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
};

type AdminProductsResponse = {
  data?: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{ node: AdminProductNode }>;
    };
  };
  errors?: Array<{ message: string }>;
};

type AdminCollectionsResponse = {
  data?: {
    collections: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{ node: AdminCollectionNode }>;
    };
  };
  errors?: Array<{ message: string }>;
};

async function adminFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const store = process.env.SHOPIFY_STORE?.trim();
  if (!store) {
    throw new Error("Missing env: set SHOPIFY_STORE (e.g. your-store.myshopify.com)");
  }
  const token = await getAdminAccessToken();

  const url = `https://${store}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    ...FETCH_OPTIONS,
  });

  const json = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        "401 Unauthorized: Admin API token invalid. Get it from: Shopify Admin → Apps → Develop apps → [Your app] → API credentials → Admin API integration → Configure → Install app (token shown once after install)."
      );
    }
    const body = JSON.stringify(json).slice(0, 300);
    throw new Error(`Shopify Admin HTTP ${res.status}: ${body}`);
  }

  if (json.errors?.length) {
    throw new Error(
      `Shopify Admin API: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`
    );
  }

  return json as T;
}

function mapAdminProductToProduct(node: AdminProductNode): ShopifyProduct {
  const prices = node.variants.edges
    .map((e) => e.node.price)
    .filter(Boolean) as string[];
  const nums = prices.map((p) => parseFloat(p)).filter((n) => !Number.isNaN(n));
  const min = nums.length ? Math.min(...nums).toFixed(2) : "0.00";
  const max = nums.length ? Math.max(...nums).toFixed(2) : "0.00";
  const img = node.featuredImage ?? node.images?.edges?.[0]?.node;
  const featuredImage = img ? { url: img.url, altText: img.altText ?? null } : undefined;
  const images = node.images?.edges?.slice(0, 3).map((e) => ({
    url: e.node.url,
    altText: e.node.altText ?? null,
  }));
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    description: stripHtml(node.descriptionHtml),
    vendor: node.vendor ?? "",
    productType: node.productType ?? "",
    availableForSale: node.status === "ACTIVE",
    priceRange: {
      minVariantPrice: { amount: min, currencyCode: "USD" },
      maxVariantPrice: { amount: max, currencyCode: "USD" },
    },
    featuredImage,
    images: images?.length ? images : undefined,
  };
}

function mapAdminCollectionToCollection(node: AdminCollectionNode): ShopifyCollection {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    description: stripHtml(node.descriptionHtml ?? ""),
  };
}

async function fetchAllProductsAdmin(): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  let after: string | null = null;
  do {
    const json: AdminProductsResponse = await adminFetch<AdminProductsResponse>(
      ADMIN_PRODUCTS_QUERY,
      { first: 50, after, query: "status:ACTIVE" }
    );
    const products = json.data?.products;
    if (!products) throw new Error("Admin API: unexpected products response.");
    for (const edge of products.edges) {
      all.push(mapAdminProductToProduct(edge.node));
    }
    after = products.pageInfo.hasNextPage ? products.pageInfo.endCursor : null;
  } while (after);
  return all;
}

async function fetchAllCollectionsAdmin(): Promise<ShopifyCollection[]> {
  const all: ShopifyCollection[] = [];
  let after: string | null = null;
  do {
    const json: AdminCollectionsResponse =
      await adminFetch<AdminCollectionsResponse>(ADMIN_COLLECTIONS_QUERY, {
        first: 50,
        after,
      });
    const collections = json.data?.collections;
    if (!collections) throw new Error("Admin API: unexpected collections response.");
    for (const edge of collections.edges) {
      all.push(mapAdminCollectionToCollection(edge.node));
    }
    after = collections.pageInfo.hasNextPage ? collections.pageInfo.endCursor : null;
  } while (after);
  return all;
}

// --- Storefront API ---

async function storefrontFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const store = process.env.SHOPIFY_STORE?.trim();
  const token = process.env.API_KEY?.trim();

  if (!store || !token) {
    throw new Error(
      "Missing env: set SHOPIFY_STORE (e.g. your-store.myshopify.com) and API_KEY (Storefront access token)"
    );
  }

  const url = `https://${store}/api/${SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    ...FETCH_OPTIONS,
  });

  const json = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        "401 Unauthorized: Storefront token invalid or wrong type. Use the Storefront access token from Shopify Admin → Settings → Apps and sales channels → Develop apps → [Your app] → API credentials → Storefront API integration (not Admin API secret)."
      );
    }
    const body = JSON.stringify(json).slice(0, 300);
    throw new Error(`Shopify HTTP ${res.status}: ${body}`);
  }

  if (json.errors?.length) {
    throw new Error(
      `Shopify API: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`
    );
  }

  return json as T;
}

function hasAdminAuth(): boolean {
  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim()) return true;
  const clientId = process.env.CLIENT_ID?.trim();
  const secret = (process.env.CLIENT_SECRET ?? process.env.SECRET_KEY)?.trim();
  return Boolean(process.env.SHOPIFY_STORE?.trim() && clientId && secret);
}

export async function fetchAllShopifyProducts(): Promise<ShopifyProduct[]> {
  if (hasAdminAuth()) {
    return fetchAllProductsAdmin();
  }
  const allProducts: ShopifyProduct[] = [];
  let after: string | null = null;

  do {
    const json: ProductsResponse =
      await storefrontFetch<ProductsResponse>(PRODUCTS_QUERY, {
        first: 50,
        after,
      });

    const products = json.data?.products;
    if (!products) {
      throw new Error(
        "Shopify API: unexpected products response. Check token has unauthenticated_read_product_listings scope."
      );
    }

    for (const edge of products.edges) {
      const node = edge.node;
      if (node.availableForSale) {
        allProducts.push(mapStorefrontProductNode(node));
      }
    }

    after = products.pageInfo.hasNextPage ? products.pageInfo.endCursor : null;
  } while (after);

  return allProducts;
}

export async function fetchAllShopifyCollections(): Promise<ShopifyCollection[]> {
  if (hasAdminAuth()) {
    return fetchAllCollectionsAdmin();
  }
  const allCollections: ShopifyCollection[] = [];
  let after: string | null = null;

  do {
    const json: CollectionsResponse =
      await storefrontFetch<CollectionsResponse>(COLLECTIONS_QUERY, {
        first: 50,
        after,
      });

    const collections = json.data?.collections;
    if (!collections) {
      throw new Error(
        "Shopify API: unexpected collections response. Check token has unauthenticated_read_collection_listings scope."
      );
    }

    for (const edge of collections.edges) {
      allCollections.push(edge.node);
    }

    after = collections.pageInfo.hasNextPage ? collections.pageInfo.endCursor : null;
  } while (after);

  return allCollections;
}
