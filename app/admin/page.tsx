import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import {
  fetchAdminShopifyOrdersForMonth,
  formatMoney as formatShopifyMoney,
  shopifyMonthTotalCents,
} from "@/lib/shopifyOrders";
import {
  fetchAdminPaymentsForMonth,
  formatMoney,
  monthTotalCents,
  parseMonthQuery,
} from "@/lib/stripePayments";
import { jobStatusRowClass, jobStatusTableRowClass } from "@/lib/adminJobStatus";
import { clampAdminPage, paginateItems, parseAdminPage } from "@/lib/adminPagination";
import AdminJobStatusSelector from "./AdminJobStatusSelector";
import AdminLogoutButton from "./AdminLogoutButton";
import AdminMonthPicker from "./AdminMonthPicker";
import AdminPagination from "./AdminPagination";
import AdminStatusBadge from "./AdminStatusBadge";

type AdminPageProps = {
  searchParams: Promise<{ month?: string; shopifyPage?: string; stripePage?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const { year, month, value: monthValue } = parseMonthQuery(params.month);

  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  let payments: Awaited<ReturnType<typeof fetchAdminPaymentsForMonth>> = [];
  let stripeError: string | null = null;

  let shopifyOrders: Awaited<ReturnType<typeof fetchAdminShopifyOrdersForMonth>> = [];
  let shopifyError: string | null = null;

  await Promise.all([
    fetchAdminPaymentsForMonth(year, month)
      .then((result) => {
        payments = result;
      })
      .catch((e) => {
        stripeError = e instanceof Error ? e.message : "Failed to load Stripe payments";
      }),
    fetchAdminShopifyOrdersForMonth(year, month)
      .then((result) => {
        shopifyOrders = result;
      })
      .catch((e) => {
        shopifyError = e instanceof Error ? e.message : "Failed to load Shopify orders";
      }),
  ]);

  const shopifyPage = clampAdminPage(
    parseAdminPage(params.shopifyPage),
    shopifyOrders.length
  );
  const stripePage = clampAdminPage(parseAdminPage(params.stripePage), payments.length);
  const paginatedShopifyOrders = paginateItems(shopifyOrders, shopifyPage);
  const paginatedPayments = paginateItems(payments, stripePage);

  const stripeTotalCents = monthTotalCents(payments);
  const stripeCurrency =
    payments.find((payment) => payment.status === "succeeded")?.currency ?? "usd";

  const shopifyTotalCents = shopifyMonthTotalCents(shopifyOrders);
  const shopifyCurrency =
    shopifyOrders.find((order) => order.financialStatus === "PAID")?.currency ?? "usd";

  return (
    <main className="min-h-screen bg-[#f3f4f6] p-4 text-[#111827] sm:p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-medium tracking-tight sm:text-2xl">Admin</h1>
          <AdminLogoutButton />
        </header>

        <AdminMonthPicker month={monthValue} />

        <section className="mb-6 overflow-hidden rounded-2xl border border-green-200/80 bg-green-50 shadow-sm sm:mb-8">
          <div className="border-b border-green-200/80 bg-green-100/50 px-4 py-3 sm:px-5">
            <h2 className="text-lg font-medium text-green-800">Shopify</h2>
            <p className="mt-1 text-sm text-green-900/80">
              {monthLabel} total:{" "}
              <strong className="font-semibold text-green-900">
                {formatShopifyMoney(shopifyTotalCents, shopifyCurrency)}
              </strong>
            </p>
          </div>

          <div className="p-4 sm:p-5">
            {shopifyError ? <p className="text-sm text-red-600">{shopifyError}</p> : null}

            {!shopifyError && shopifyOrders.length === 0 ? (
              <p className="text-sm text-[#4b5563]">No orders for this month.</p>
            ) : null}

            {!shopifyError && shopifyOrders.length > 0 ? (
              <>
                <ul className="space-y-3 md:hidden">
                  {paginatedShopifyOrders.map((order) => (
                    <li
                      key={order.id}
                      className={`rounded-xl border p-3.5 shadow-sm ${jobStatusRowClass(order.jobStatus, "shopify")}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-[#111827]">{order.name}</p>
                        <p className="shrink-0 font-medium">
                          {formatShopifyMoney(order.amountCents, order.currency)}
                        </p>
                      </div>
                      <dl className="mt-2.5 space-y-1.5 text-sm text-[#4b5563]">
                        <div className="flex justify-between gap-3">
                          <dt>Customer</dt>
                          <dd className="text-right text-[#111827]">{order.customerLabel}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Created</dt>
                          <dd className="text-right text-[#111827]">
                            {order.createdAt.toLocaleString("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Payment</dt>
                          <dd>
                            <AdminStatusBadge
                              status={order.financialStatus}
                              variant="shopify"
                            />
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-0.5">
                          <dt>Job</dt>
                          <dd>
                            <AdminJobStatusSelector
                              source="shopify"
                              id={order.id}
                              initialStatus={order.jobStatus}
                            />
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-green-200/80 text-left">
                        <th className="py-2 pr-3 font-medium">Order</th>
                        <th className="py-2 pr-3 font-medium">Customer</th>
                        <th className="py-2 pr-3 font-medium">Amount</th>
                        <th className="py-2 pr-3 font-medium">Created at</th>
                        <th className="py-2 pr-3 font-medium">Payment</th>
                        <th className="py-2 font-medium">Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedShopifyOrders.map((order) => (
                        <tr
                          key={order.id}
                          className={`border-b border-green-200/50 ${jobStatusTableRowClass(order.jobStatus)}`}
                        >
                          <td className="py-2.5 pr-3 font-medium">{order.name}</td>
                          <td className="py-2.5 pr-3">{order.customerLabel}</td>
                          <td className="py-2.5 pr-3">
                            {formatShopifyMoney(order.amountCents, order.currency)}
                          </td>
                          <td className="py-2.5 pr-3">
                            {order.createdAt.toLocaleString("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="py-2.5 pr-3">
                            <AdminStatusBadge
                              status={order.financialStatus}
                              variant="shopify"
                            />
                          </td>
                          <td className="py-2.5">
                            <AdminJobStatusSelector
                              source="shopify"
                              id={order.id}
                              initialStatus={order.jobStatus}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <AdminPagination
                  month={monthValue}
                  pageParam="shopifyPage"
                  currentPage={shopifyPage}
                  totalItems={shopifyOrders.length}
                  shopifyPage={shopifyPage}
                  stripePage={stripePage}
                />
              </>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-purple-200/80 bg-purple-50 shadow-sm">
          <div className="border-b border-purple-200/80 bg-purple-100/50 px-4 py-3 sm:px-5">
            <h2 className="text-lg font-medium text-purple-800">Stripe</h2>
            <p className="mt-1 text-sm text-purple-900/80">
              {monthLabel} total:{" "}
              <strong className="font-semibold text-purple-900">
                {formatMoney(stripeTotalCents, stripeCurrency)}
              </strong>
            </p>
          </div>

          <div className="p-4 sm:p-5">
            {stripeError ? <p className="text-sm text-red-600">{stripeError}</p> : null}

            {!stripeError && payments.length === 0 ? (
              <p className="text-sm text-[#4b5563]">No payments for this month.</p>
            ) : null}

            {!stripeError && payments.length > 0 ? (
              <>
                <ul className="space-y-3 md:hidden">
                  {paginatedPayments.map((payment) => (
                    <li
                      key={payment.id}
                      className={`rounded-xl border p-3.5 shadow-sm ${jobStatusRowClass(payment.jobStatus, "stripe")}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-[#111827]">{payment.orderNumber}</p>
                        <p className="shrink-0 font-medium">
                          {formatMoney(payment.amount, payment.currency)}
                        </p>
                      </div>
                      <dl className="mt-2.5 space-y-1.5 text-sm text-[#4b5563]">
                        <div className="flex justify-between gap-3">
                          <dt>Customer</dt>
                          <dd className="text-right text-[#111827]">{payment.customerLabel}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt>Paid at</dt>
                          <dd className="text-right text-[#111827]">
                            {payment.paidAt
                              ? payment.paidAt.toLocaleString("en-US", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Payment</dt>
                          <dd>
                            <AdminStatusBadge status={payment.status} variant="stripe" />
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 pt-0.5">
                          <dt>Job</dt>
                          <dd>
                            <AdminJobStatusSelector
                              source="stripe"
                              id={payment.id}
                              initialStatus={payment.jobStatus}
                            />
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-purple-200/80 text-left">
                        <th className="py-2 pr-3 font-medium">Order</th>
                        <th className="py-2 pr-3 font-medium">Customer</th>
                        <th className="py-2 pr-3 font-medium">Amount</th>
                        <th className="py-2 pr-3 font-medium">Paid at</th>
                        <th className="py-2 pr-3 font-medium">Payment</th>
                        <th className="py-2 font-medium">Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPayments.map((payment) => (
                        <tr
                          key={payment.id}
                          className={`border-b border-purple-200/50 ${jobStatusTableRowClass(payment.jobStatus)}`}
                        >
                          <td className="py-2.5 pr-3 font-medium">{payment.orderNumber}</td>
                          <td className="py-2.5 pr-3">{payment.customerLabel}</td>
                          <td className="py-2.5 pr-3">
                            {formatMoney(payment.amount, payment.currency)}
                          </td>
                          <td className="py-2.5 pr-3">
                            {payment.paidAt
                              ? payment.paidAt.toLocaleString("en-US", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "—"}
                          </td>
                          <td className="py-2.5 pr-3">
                            <AdminStatusBadge status={payment.status} variant="stripe" />
                          </td>
                          <td className="py-2.5">
                            <AdminJobStatusSelector
                              source="stripe"
                              id={payment.id}
                              initialStatus={payment.jobStatus}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <AdminPagination
                  month={monthValue}
                  pageParam="stripePage"
                  currentPage={stripePage}
                  totalItems={payments.length}
                  shopifyPage={shopifyPage}
                  stripePage={stripePage}
                />
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
