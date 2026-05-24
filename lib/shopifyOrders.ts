import { adminFetch } from "@/app/lib/shopify";
import {
  parseJobStatus,
  SHOPIFY_JOB_STATUS_KEY,
  SHOPIFY_JOB_STATUS_NAMESPACE,
  type JobStatus,
} from "@/lib/adminJobStatus";
import { formatMoney } from "@/lib/stripePayments";

export type AdminShopifyOrderRow = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  createdAt: Date;
  financialStatus: string;
  customerLabel: string;
  jobStatus: JobStatus;
};

const ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            email
            displayName
          }
          metafield(namespace: "${SHOPIFY_JOB_STATUS_NAMESPACE}", key: "${SHOPIFY_JOB_STATUS_KEY}") {
            value
          }
        }
      }
    }
  }
`;

type OrdersResponse = {
  data?: {
    orders: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{
        node: {
          id: string;
          name: string;
          createdAt: string;
          displayFinancialStatus: string;
          totalPriceSet: {
            shopMoney: { amount: string; currencyCode: string };
          };
          customer?: { email?: string | null; displayName?: string | null } | null;
          metafield?: { value: string } | null;
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
};

function monthRangeQuery(year: number, month: number): string {
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${year}-${monthStr}-01`;
  const end = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return `created_at:>=${start} created_at:<=${end}`;
}

function customerLabel(
  customer: { email?: string | null; displayName?: string | null } | null | undefined
): string {
  if (customer?.email) return customer.email;
  if (customer?.displayName) return customer.displayName;
  return "Unknown customer";
}

type OrderNode = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  totalPriceSet: {
    shopMoney: { amount: string; currencyCode: string };
  };
  customer?: { email?: string | null; displayName?: string | null } | null;
  metafield?: { value: string } | null;
};

function mapOrder(node: OrderNode): AdminShopifyOrderRow {
  const amount = parseFloat(node.totalPriceSet.shopMoney.amount);
  return {
    id: node.id,
    name: node.name,
    amountCents: Math.round(amount * 100),
    currency: node.totalPriceSet.shopMoney.currencyCode.toLowerCase(),
    createdAt: new Date(node.createdAt),
    financialStatus: node.displayFinancialStatus,
    customerLabel: customerLabel(node.customer),
    jobStatus: parseJobStatus(node.metafield?.value),
  };
}

export async function fetchAdminShopifyOrdersForMonth(
  year: number,
  month: number
): Promise<AdminShopifyOrderRow[]> {
  const query = monthRangeQuery(year, month);
  const rows: AdminShopifyOrderRow[] = [];
  let after: string | null = null;

  do {
    const json: OrdersResponse = await adminFetch<OrdersResponse>(ORDERS_QUERY, {
      first: 50,
      after,
      query,
    });

    const orders: NonNullable<OrdersResponse["data"]>["orders"] | undefined = json.data?.orders;
    if (!orders) {
      throw new Error("Shopify API: unexpected orders response. Check read_orders scope.");
    }

    for (const edge of orders.edges) {
      rows.push(mapOrder(edge.node));
    }

    after = orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : null;
  } while (after);

  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function shopifyMonthTotalCents(orders: AdminShopifyOrderRow[]): number {
  return orders
    .filter((order) => order.financialStatus === "PAID")
    .reduce((sum, order) => sum + order.amountCents, 0);
}

export { formatMoney };
