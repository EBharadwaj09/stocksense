import type { Metadata } from "next";
import { requireOwner } from "@/lib/shop";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireOwner();
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold text-brand-900">Add a product</h1>
      <ProductForm
        initial={{ name: "", sku: "", unit: "pcs", price: "", cost: "", reorderPoint: "0", leadTimeDays: "7" }}
      />
    </div>
  );
}
