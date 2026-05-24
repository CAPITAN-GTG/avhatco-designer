export const ADMIN_PAGE_SIZE = 10;

export function parseAdminPage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

export function adminTotalPages(totalItems: number, pageSize = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampAdminPage(page: number, totalItems: number, pageSize = ADMIN_PAGE_SIZE): number {
  return Math.min(page, adminTotalPages(totalItems, pageSize));
}

export function paginateItems<T>(items: T[], page: number, pageSize = ADMIN_PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function buildAdminHref(
  month: string,
  shopifyPage: number,
  stripePage: number,
  updates: Partial<{ shopifyPage: number; stripePage: number }>
): string {
  const nextShopifyPage = updates.shopifyPage ?? shopifyPage;
  const nextStripePage = updates.stripePage ?? stripePage;
  const params = new URLSearchParams({ month });

  if (nextShopifyPage > 1) {
    params.set("shopifyPage", String(nextShopifyPage));
  }
  if (nextStripePage > 1) {
    params.set("stripePage", String(nextStripePage));
  }

  return `/admin?${params.toString()}`;
}
