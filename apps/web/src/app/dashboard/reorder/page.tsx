import type { Metadata } from "next";
import Link from "next/link";
import { getForecasts, getProductsWithStock, todayIn } from "@/lib/data";
import { COVER_DAYS, compareUrgency, planReorder, type ReorderStatus } from "@/lib/reorder";
import { formatDate, formatQty, requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Reorder" };

const STATUS: Record<ReorderStatus, { label: string; className: string }> = {
  order_now: { label: "Order now", className: "bg-red-100 text-red-800" },
  order_soon: { label: "Order soon", className: "bg-amber-100 text-amber-900" },
  ok: { label: "Enough stock", className: "bg-emerald-100 text-emerald-800" },
  no_forecast: { label: "No forecast yet", className: "bg-slate-100 text-slate-700" },
};

const MODEL_LABELS: Record<string, string> = {
  lightgbm: "trained model",
  sklearn: "trained model",
  moving_average_28d: "28-day average (needs 2 months of sales for the trained model)",
};

export default async function ReorderPage() {
  const { shop, role } = await requireShop();
  const today = todayIn(shop.timezone);
  const [products, { byProduct, run }] = await Promise.all([
    getProductsWithStock(shop.id, { activeOnly: true }),
    getForecasts(shop.id, today),
  ]);

  const rows = products
    .map((p) => ({
      product: p,
      plan: planReorder({
        onHand: p.onHand,
        leadTimeDays: p.leadTimeDays,
        reorderPoint: p.reorderPoint,
        forecast: byProduct.get(p.id) ?? [],
      }),
    }))
    .sort((a, b) => compareUrgency(a.plan, b.plan) || a.product.name.localeCompare(b.product.name));
  const toOrder = rows.filter((r) => r.plan.status === "order_now" || r.plan.status === "order_soon");
  const stale = run !== null && run.firstDay < today;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Reorder list</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Based on each product&apos;s expected sales for the next 14 days, its lead time and its reorder point (kept as a
          safety buffer). Suggested quantities cover the lead time plus {COVER_DAYS} more days.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {run ? (
            <>
              Forecast updated {formatDate(run.generatedAt)} using the {MODEL_LABELS[run.model] ?? run.model}.
              {stale ? " It is more than a day old; the next nightly run will refresh it." : ""}
            </>
          ) : (
            "Forecasts appear after the next nightly run (around 2 am). Until then, use the reorder points on the Overview."
          )}
        </p>
      </div>

      {products.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No products yet. <Link className="font-semibold text-brand-700 underline" href="/dashboard/products/new">Add one</Link>.
        </p>
      ) : (
        <section aria-labelledby="reorder-heading" className="rounded-xl border border-slate-200 bg-white">
          <h2 id="reorder-heading" className="border-b border-slate-200 px-5 py-4 font-semibold text-brand-900">
            {toOrder.length === 0 ? "Nothing to order right now" : `${toOrder.length} to order`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">In stock</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Next 7 days</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Days left</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Lead time</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Suggested order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ product: p, plan }) => (
                  <tr key={p.id}>
                    <th scope="row" className="px-5 py-3 font-medium text-slate-900">
                      {role === "owner" ? (
                        <Link href={`/dashboard/products/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                      ) : (
                        p.name
                      )}
                    </th>
                    <td className="px-3 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[plan.status].className}`}>
                        {STATUS[plan.status].label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatQty(p.onHand)} {p.unit}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {plan.status === "no_forecast" ? "—" : formatQty(Math.round(plan.next7Days))}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {plan.daysLeft === null ? "—" : plan.daysLeft >= 60 ? "60+" : plan.daysLeft}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{p.leadTimeDays} d</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-brand-900">
                      {plan.suggestedQty > 0 ? `${formatQty(plan.suggestedQty)} ${p.unit}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
