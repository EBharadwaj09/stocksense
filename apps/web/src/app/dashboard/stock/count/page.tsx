import type { Metadata } from "next";
import Link from "next/link";
import { getProductsWithStock } from "@/lib/data";
import { requireShop } from "@/lib/shop";
import { StockCountForm } from "./StockCountForm";

export const metadata: Metadata = { title: "Stock count" };

export default async function StockCountPage() {
  const { shop } = await requireShop();
  const products = await getProductsWithStock(shop.id, { activeOnly: true });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm">
          <Link href="/dashboard/stock" className="font-semibold text-brand-700 underline underline-offset-2">
            ← Stock
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-brand-900">Stock count</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Type what is on the shelf right now. Leave a product blank to skip it. We record the difference from the stock
          shown, so you can count everything at once or just a few items.
        </p>
      </div>
      {products.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No products yet.</p>
      ) : (
        <StockCountForm
          products={products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, onHand: p.onHand }))}
        />
      )}
    </div>
  );
}
