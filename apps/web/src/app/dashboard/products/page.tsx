import type { Metadata } from "next";
import Link from "next/link";
import { getProductsWithStock, isLowStock } from "@/lib/data";
import { formatMoney, formatQty, requireShop } from "@/lib/shop";
import { setProductActive } from "../actions";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const { shop, role } = await requireShop();
  const isOwner = role === "owner";
  const products = await getProductsWithStock(shop.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Products</h1>
          <p className="text-sm text-slate-600">{products.length} products</p>
        </div>
        {isOwner ? (
          <Link href="/dashboard/products/new" className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700">
            Add product
          </Link>
        ) : null}
      </div>

      {products.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">No products yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Products with current stock</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Product</th>
                <th scope="col" className="px-4 py-3 font-medium">Code</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">In stock</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Reorder at</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
                {isOwner ? <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className={p.active ? "" : "text-slate-400"}>
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {!p.active ? <span className="ml-2 text-xs">(hidden)</span> : null}
                  </td>
                  <td className="px-4 py-3">{p.sku ?? "—"}</td>
                  <td className={`px-4 py-3 text-right ${isLowStock(p) ? "font-semibold text-amber-700" : ""}`}>
                    {formatQty(p.onHand)} {p.unit}
                  </td>
                  <td className="px-4 py-3 text-right">{p.reorderPoint > 0 ? formatQty(p.reorderPoint) : "—"}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(p.price, shop.currency)}</td>
                  {isOwner ? (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/dashboard/products/${p.id}`} className="rounded px-2 py-1 font-medium text-brand-700 hover:bg-brand-50">
                          Edit<span className="sr-only"> {p.name}</span>
                        </Link>
                        <form action={setProductActive}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                          <button type="submit" className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-slate-100">
                            {p.active ? "Hide" : "Show"}
                            <span className="sr-only"> {p.name}</span>
                          </button>
                        </form>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
