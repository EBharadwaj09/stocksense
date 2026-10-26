import type { Metadata } from "next";
import Link from "next/link";
import { getForecasts, getProductsWithStock, isLowStock, todayIn } from "@/lib/data";
import { compareUrgency, planReorder } from "@/lib/reorder";
import { daysAgoIso, formatDate, formatMoney, formatQty, getShopContext } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { shop, role } = await getShopContext();
  // Without a shop, the layout shows onboarding instead of this page.
  if (!shop) return null;
  const supabase = await createClient();
  const since = daysAgoIso(7);

  const [products, { data: recentSales }, { data: weekSales }, { byProduct }] = await Promise.all([
    getProductsWithStock(shop.id, { activeOnly: true }),
    supabase
      .from("sales")
      .select("id, product_id, quantity, unit_price, sold_at")
      .eq("shop_id", shop.id)
      .order("sold_at", { ascending: false })
      .limit(8),
    supabase.from("sales").select("quantity, unit_price").eq("shop_id", shop.id).gte("sold_at", since),
    getForecasts(shop.id, todayIn(shop.timezone)),
  ]);

  const names = new Map(products.map((p) => [p.id, p]));
  // One rule everywhere: with a forecast, the reorder plan decides; without one, the reorder point does.
  const plans = products.map((p) => {
    const forecast = byProduct.get(p.id) ?? [];
    const plan = planReorder({ onHand: p.onHand, leadTimeDays: p.leadTimeDays, reorderPoint: p.reorderPoint, forecast });
    const urgent = plan.status === "no_forecast" ? isLowStock(p) : plan.status === "order_now";
    return { product: p, plan, urgent };
  });
  const needsReorder = plans
    .filter((r) => r.urgent)
    .sort((a, b) => compareUrgency(a.plan, b.plan) || a.product.name.localeCompare(b.product.name));
  const orderSoon = plans.filter((r) => r.plan.status === "order_soon").length;
  const hasForecast = byProduct.size > 0;
  const weekRevenue = (weekSales ?? []).reduce((sum, s) => sum + Number(s.quantity) * Number(s.unit_price ?? 0), 0);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-brand-900">Let&apos;s add your products</h1>
        <p className="mx-auto mt-2 max-w-md text-slate-600">
          {role === "owner"
            ? "Add products one by one, or import last year's sales from a spreadsheet and we'll create the products for you."
            : "The shop owner hasn't added products yet. Once they do, you can record sales and stock here."}
        </p>
        {role === "owner" ? (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard/products/new" className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700">
              Add a product
            </Link>
            <Link href="/dashboard/import" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold hover:bg-slate-50">
              Import sales
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-900">Overview</h1>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Products" value={String(products.length)} />
        <Stat
          label="Order now"
          value={String(needsReorder.length)}
          tone={needsReorder.length > 0 ? "warn" : "ok"}
          href="/dashboard/reorder"
        />
        <Stat label="Order soon" value={hasForecast ? String(orderSoon) : "—"} href="/dashboard/reorder" />
        <Stat label="Sales, last 7 days" value={formatMoney(weekRevenue, shop.currency)} />
      </dl>

      <section aria-labelledby="low-heading" className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="low-heading" className="font-semibold text-brand-900">
            Order now
          </h2>
          <Link href="/dashboard/reorder" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
            Full reorder list
          </Link>
        </div>
        {needsReorder.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">
            {hasForecast
              ? "Nothing needs ordering right now."
              : "Nothing is at or below its reorder point. Sales forecasts appear after the nightly run."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {needsReorder.slice(0, 8).map(({ product: p, plan }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className="font-medium text-slate-900">{p.name}</span>
                <span className="text-amber-800">
                  {formatQty(p.onHand)} {p.unit} left
                  {plan.daysLeft !== null ? ` · ${plan.daysLeft === 0 ? "runs out today" : `about ${plan.daysLeft} days`}` : ""}
                  {plan.suggestedQty > 0
                    ? ` · order ${formatQty(plan.suggestedQty)} ${p.unit}`
                    : ` · reorder at ${formatQty(p.reorderPoint)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {needsReorder.length > 8 ? (
          <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
            and {needsReorder.length - 8} more on the{" "}
            <Link href="/dashboard/reorder" className="font-semibold text-brand-700 underline">
              reorder list
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section aria-labelledby="recent-heading" className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="recent-heading" className="font-semibold text-brand-900">
            Recent sales
          </h2>
          <Link href="/dashboard/sales" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
            Record a sale
          </Link>
        </div>
        {(recentSales ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">No sales recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(recentSales ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-slate-900">
                  {names.get(s.product_id)?.name ?? "Product"} × {formatQty(s.quantity)}
                </span>
                <span className="text-slate-600">{formatDate(s.sold_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: string; tone?: "ok" | "warn"; href?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <dt className="text-sm text-slate-600">
        {href ? (
          <Link href={href} className="underline-offset-2 hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className={`mt-1 text-2xl font-bold ${tone === "warn" ? "text-amber-700" : "text-brand-900"}`}>{value}</dd>
    </div>
  );
}
