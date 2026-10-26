import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { shop } = await requireOwner();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!p) notFound();

  const str = (n: number | null) => (n === null ? "" : String(n));
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold text-brand-900">Edit {p.name}</h1>
      <ProductForm
        initial={{
          id: p.id,
          name: p.name,
          sku: p.sku ?? "",
          unit: p.unit,
          price: str(p.price),
          cost: str(p.cost),
          reorderPoint: String(p.reorder_point),
          leadTimeDays: String(p.lead_time_days),
        }}
      />
    </div>
  );
}
