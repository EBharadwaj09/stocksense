import type { Metadata } from "next";
import { getProductsWithStock } from "@/lib/data";
import { formatDate, formatQty, requireShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { StockForm } from "./StockForm";

export const metadata: Metadata = { title: "Stock" };

const REASON_LABELS: Record<string, string> = {
  purchase: "Received",
  opening: "Opening stock",
  adjustment: "Correction",
  sale: "Sale",
};

export default async function StockPage() {
  const { shop } = await requireShop();
  const supabase = await createClient();
  const [products, { data: movements }] = await Promise.all([
    getProductsWithStock(shop.id),
    supabase
      .from("stock_movements")
      .select("id, product_id, quantity, reason, note, occurred_at")
      .eq("shop_id", shop.id)
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const options = products
    .filter((p) => p.active)
    .map((p) => ({ value: p.id, label: `${p.name} — ${formatQty(p.onHand)} ${p.unit} now` }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="stock-heading" className="h-fit rounded-xl border border-slate-200 bg-white p-6">
        <h1 id="stock-heading" className="mb-4 text-xl font-bold text-brand-900">
          Update stock
        </h1>
        {options.length === 0 ? <p className="text-sm text-slate-600">Add a product first.</p> : <StockForm products={options} />}
      </section>

      <section aria-labelledby="history-heading" className="rounded-xl border border-slate-200 bg-white">
        <h2 id="history-heading" className="border-b border-slate-200 px-5 py-4 font-semibold text-brand-900">
          Latest 50 stock changes
        </h2>
        {(movements ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">No stock changes yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(movements ?? []).map((m) => {
              const p = byId.get(m.product_id);
              const qty = Number(m.quantity);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{p?.name ?? "Product"}</p>
                    <p className="truncate text-slate-600">
                      {REASON_LABELS[m.reason] ?? m.reason} · {formatDate(m.occurred_at)}
                      {m.note ? ` · ${m.note}` : ""}
                    </p>
                  </div>
                  <span className={`whitespace-nowrap font-semibold ${qty < 0 ? "text-red-700" : "text-brand-700"}`}>
                    {qty > 0 ? "+" : ""}
                    {formatQty(qty)} {p?.unit}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
