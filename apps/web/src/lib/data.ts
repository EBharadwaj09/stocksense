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

export type ForecastRun = {
  generatedAt: string;
  firstDay: string;
  model: string;
  historyDays: number;
};

/** Today's date (YYYY-MM-DD) in the shop's timezone. */
export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

/**
 * Forecast units per product from `fromDay` onward (days in order), plus details of the last nightly run.
 * The nightly job writes these; members can only read their own shop's rows.
 */
export async function getForecasts(
  shopId: string,
  fromDay: string,
): Promise<{ byProduct: Map<string, number[]>; run: ForecastRun | null }> {
  const supabase = await createClient();
  const pageSize = 1000; // the API returns at most 1000 rows per request
  const rows: { product_id: string; day: string; quantity: number }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("forecasts")
      .select("product_id, day, quantity")
      .eq("shop_id", shopId)
      .gte("day", fromDay)
      .order("product_id")
      .order("day")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not load forecasts: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  const { data: run, error: runError } = await supabase
    .from("forecast_runs")
    .select("generated_at, first_day, model, history_days")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (runError) throw new Error(`Could not load forecast status: ${runError.message}`);

  const byProduct = new Map<string, number[]>();
  for (const r of rows) {
    const list = byProduct.get(r.product_id) ?? [];
    list.push(Number(r.quantity));
    byProduct.set(r.product_id, list);
  }
  return {
    byProduct,
    run: run
      ? { generatedAt: run.generated_at, firstDay: run.first_day, model: run.model, historyDays: run.history_days }
      : null,
  };
}
