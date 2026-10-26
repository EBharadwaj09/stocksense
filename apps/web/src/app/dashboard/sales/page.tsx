import type { Metadata } from "next";
import { getProductsWithStock } from "@/lib/data";
import { todayInIndia } from "@/lib/schemas";
import { formatDate, formatMoney, formatQty, requireShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { RecordSaleForm } from "./RecordSaleForm";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage() {
  const { shop } = await requireShop();
  const supabase = await createClient();
  const [products, { data: sales }] = await Promise.all([
    getProductsWithStock(shop.id),
    supabase
      .from("sales")
      .select("id, product_id, quantity, unit_price, sold_at, source")
      .eq("shop_id", shop.id)
      .order("sold_at", { ascending: false })
      .limit(50),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const options = products
    .filter((p) => p.active)
    .map((p) => ({ value: p.id, label: `${p.name} — ${formatQty(p.onHand)} ${p.unit} in stock` }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="record-heading" className="h-fit rounded-xl border border-slate-200 bg-white p-6">
        <h1 id="record-heading" className="mb-4 text-xl font-bold text-brand-900">
          Record a sale
        </h1>
        {options.length === 0 ? (
          <p className="text-sm text-slate-600">Add a product first.</p>
        ) : (
          <RecordSaleForm products={options} today={todayInIndia()} />
        )}
      </section>

      <section aria-labelledby="list-heading" className="rounded-xl border border-slate-200 bg-white">
        <h2 id="list-heading" className="border-b border-slate-200 px-5 py-4 font-semibold text-brand-900">
          Latest 50 sales
        </h2>
        {(sales ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">No sales yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm sm:min-w-[480px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(sales ?? []).map((s) => {
                  const p = byId.get(s.product_id);
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 text-slate-600">
                        {formatDate(s.sold_at)}
                        {s.source === "import" ? <span className="ml-1 text-xs text-slate-500">(imported)</span> : null}
                      </td>
                      <td className="px-4 py-2.5">{p?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {formatQty(s.quantity)} {p?.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {s.unit_price === null ? "—" : formatMoney(Number(s.quantity) * Number(s.unit_price), shop.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
