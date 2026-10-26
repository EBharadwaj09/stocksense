import type { Metadata } from "next";
import Link from "next/link";
import { getProductsWithStock, isLowStock } from "@/lib/data";
import { daysAgoIso, formatDate, formatMoney, formatQty, getShopContext } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { shop, role } = await getShopContext();
  // Without a shop, the layout shows onboarding instead of this page.
  if (!shop) return null;
  const supabase = await createClient();
  const since = daysAgoIso(7);

  const [products, { data: recentSales }, { data: weekSales }] = await Promise.all([
    getProductsWithStock(shop.id, { activeOnly: true }),
    supabase
      .from("sales")
      .select("id, product_id, quantity, unit_price, sold_at")
      .eq("shop_id", shop.id)
      .order("sold_at", { ascending: false })
      .limit(8),
    supabase.from("sales").select("quantity, unit_price").eq("shop_id", shop.id).gte("sold_at", since),
  ]);

  const names = new Map(products.map((p) => [p.id, p]));
  const lowStock = products.filter(isLowStock);
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

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Products" value={String(products.length)} />
        <Stat label="Running low" value={String(lowStock.length)} tone={lowStock.length > 0 ? "warn" : "ok"} />
        <Stat label="Sales, last 7 days" value={formatMoney(weekRevenue, shop.currency)} />
      </dl>

      <section aria-labelledby="low-heading" className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="low-heading" className="font-semibold text-brand-900">
            Running low
          </h2>
          <Link href="/dashboard/stock" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
            Add stock
          </Link>
        </div>
        {lowStock.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">Nothing is at or below its reorder point.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium text-slate-900">{p.name}</span>
                <span className="text-amber-800">
                  {formatQty(p.onHand)} {p.unit} left · reorder at {formatQty(p.reorderPoint)}
                </span>
              </li>
            ))}
          </ul>
        )}
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold ${tone === "warn" ? "text-amber-700" : "text-brand-900"}`}>{value}</dd>
    </div>
  );
}
