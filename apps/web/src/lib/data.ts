import { createClient } from "@/lib/supabase/server";

export type ProductWithStock = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  price: number | null;
  reorderPoint: number;
  leadTimeDays: number;
  active: boolean;
  onHand: number;
};

/** All products of a shop with current stock, sorted by name. */
export async function getProductsWithStock(shopId: string, opts: { activeOnly?: boolean } = {}): Promise<ProductWithStock[]> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, sku, unit, price, reorder_point, lead_time_days, active")
    .eq("shop_id", shopId)
    .order("name");
  if (opts.activeOnly) query = query.eq("active", true);

  const [{ data: products, error }, { data: stock, error: stockError }] = await Promise.all([
    query,
    supabase.from("product_stock").select("product_id, on_hand").eq("shop_id", shopId),
  ]);
  if (error) throw new Error(`Could not load products: ${error.message}`);
  if (stockError) throw new Error(`Could not load stock: ${stockError.message}`);

  const onHand = new Map((stock ?? []).map((s) => [s.product_id, Number(s.on_hand ?? 0)]));
  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    price: p.price,
    reorderPoint: p.reorder_point,
    leadTimeDays: p.lead_time_days,
    active: p.active,
    onHand: onHand.get(p.id) ?? 0,
  }));
}

export function isLowStock(p: Pick<ProductWithStock, "onHand" | "reorderPoint" | "active">): boolean {
  return p.active && p.reorderPoint > 0 && p.onHand <= p.reorderPoint;
}
