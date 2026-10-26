"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { friendlyDbError } from "@/lib/db-errors";
import { IMPORT_CHUNK_SIZE, type RowError } from "@/lib/import";
import { log } from "@/lib/log";
import { inviteSchema, productSchema, saleSchema, shopNameSchema, stockSchema, todayInIndia } from "@/lib/schemas";
import { getShopContext, requireShop } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { toFieldErrors, type FieldErrors } from "@/lib/validation";

export type ActionState = {
  fieldErrors?: FieldErrors;
  formError?: string;
  notice?: string;
  values?: Record<string, string>;
  /** Set on success so forms can reset themselves (used as a React key). */
  savedAt?: number;
};

function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

function refresh() {
  revalidatePath("/dashboard", "layout");
}

// ------------------------------------------------------------------ shop

export async function createShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name"]);
  const parsed = shopNameSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_shop", { p_name: parsed.data.name });
  if (error) {
    log("warn", "shop.create_failed", { code: error.code });
    return { formError: friendlyDbError(error), values };
  }
  refresh();
  redirect("/dashboard");
}

export async function acceptInvite(formData: FormData): Promise<void> {
  const inviteId = z.uuid().safeParse(formData.get("inviteId"));
  if (!inviteId.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_invite: inviteId.data });
  if (error) log("warn", "invite.accept_failed", { code: error.code });
  refresh();
  redirect("/dashboard");
}

// -------------------------------------------------------------- products

const PRODUCT_FIELDS = ["name", "sku", "unit", "price", "cost", "reorderPoint", "leadTimeDays"];

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, PRODUCT_FIELDS);
  const ctx = await requireShop();
  if (ctx.role !== "owner") return { formError: "Only the shop owner can change products.", values };

  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };
  const p = parsed.data;
  const row = {
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    price: p.price ?? null,
    cost: p.cost ?? null,
    reorder_point: p.reorderPoint,
    lead_time_days: p.leadTimeDays,
  };

  const supabase = await createClient();
  const id = z.uuid().safeParse(formData.get("id"));
  const { error } = id.success
    ? await supabase.from("products").update(row).eq("id", id.data).eq("shop_id", ctx.shop.id)
    : await supabase.from("products").insert({ ...row, shop_id: ctx.shop.id });

  if (error) {
    log("warn", "product.save_failed", { code: error.code });
    return { formError: friendlyDbError(error), values };
  }
  refresh();
  redirect("/dashboard/products");
}

export async function setProductActive(formData: FormData): Promise<void> {
  const ctx = await requireShop();
  const id = z.uuid().safeParse(formData.get("id"));
  if (ctx.role !== "owner" || !id.success) return;
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("products").update({ active }).eq("id", id.data).eq("shop_id", ctx.shop.id);
  refresh();
}

// ---------------------------------------------------------- sales & stock

export async function recordSale(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["productId", "quantity", "unitPrice", "soldOn"]);
  await requireShop();
  const parsed = saleSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };
  const s = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_sale", {
    p_product: s.productId,
    p_quantity: s.quantity,
    ...(s.unitPrice !== undefined ? { p_unit_price: s.unitPrice } : {}),
    // Today's sales get the exact time; back-dated sales are stored at midday.
    ...(s.soldOn !== todayInIndia() ? { p_sold_at: `${s.soldOn}T12:00:00Z` } : {}),
  });
  if (error) {
    log("warn", "sale.record_failed", { code: error.code });
    return { formError: friendlyDbError(error), values };
  }
  refresh();
  return { notice: "Sale recorded.", values: { productId: s.productId, soldOn: s.soldOn }, savedAt: Date.now() };
}

export async function recordStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["productId", "reason", "quantity", "note"]);
  const ctx = await requireShop();
  const parsed = stockSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };
  const m = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    shop_id: ctx.shop.id,
    product_id: m.productId,
    quantity: m.quantity,
    reason: m.reason,
    note: m.note,
    created_by: ctx.user.id,
  });
  if (error) {
    log("warn", "stock.record_failed", { code: error.code });
    return { formError: friendlyDbError(error), values };
  }
  refresh();
  return { notice: "Stock updated.", values: { productId: m.productId, reason: m.reason }, savedAt: Date.now() };
}

// ------------------------------------------------------------------ team

export async function inviteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const ctx = await requireShop();
  if (ctx.role !== "owner") return { formError: "Only the shop owner can invite staff.", values };
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };
  if (parsed.data.email === ctx.user.email.toLowerCase()) {
    return { fieldErrors: { email: "That's your own email." }, values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_invites")
    .insert({ shop_id: ctx.shop.id, email: parsed.data.email, invited_by: ctx.user.id });
  if (error) {
    if (error.code === "23505") return { fieldErrors: { email: "This email has already been invited." }, values };
    log("warn", "invite.create_failed", { code: error.code });
    return { formError: friendlyDbError(error), values };
  }
  refresh();
  return { notice: `Invite created for ${parsed.data.email}.`, savedAt: Date.now() };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  const ctx = await requireShop();
  const id = z.uuid().safeParse(formData.get("id"));
  if (ctx.role !== "owner" || !id.success) return;
  const supabase = await createClient();
  await supabase.from("shop_invites").delete().eq("id", id.data).eq("shop_id", ctx.shop.id);
  refresh();
}

export async function removeMember(formData: FormData): Promise<void> {
  const ctx = await requireShop();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (ctx.role !== "owner" || !userId.success || userId.data === ctx.user.id) return;
  const supabase = await createClient();
  await supabase.from("shop_members").delete().eq("shop_id", ctx.shop.id).eq("user_id", userId.data).eq("role", "staff");
  refresh();
}

// ---------------------------------------------------------------- import

const importRowSchema = z.object({
  row: z.number().int().positive(),
  sku: z.string().max(64).nullable(),
  name: z.string().max(120).nullable(),
  quantity: z.number().positive().max(1_000_000),
  unit_price: z.number().min(0).max(10_000_000).nullable(),
  sold_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T12:00:00Z$/),
});

export type ImportChunkResult =
  | { ok: true; inserted: number; createdProducts: number; errors: RowError[] }
  | { ok: false; message: string };

/** Imports one batch of already-validated rows. The server re-validates everything. */
export async function importSalesChunk(rows: unknown, createMissing: boolean): Promise<ImportChunkResult> {
  const ctx = await getShopContext();
  if (!ctx.shop || ctx.role !== "owner") return { ok: false, message: "Only the shop owner can import sales." };

  const parsed = z.array(importRowSchema).min(1).max(IMPORT_CHUNK_SIZE).safeParse(rows);
  if (!parsed.success) return { ok: false, message: "Some rows were not in the expected format. Re-check the file." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_sales", {
    p_shop: ctx.shop.id,
    p_rows: parsed.data as unknown as Json,
    p_create_missing: Boolean(createMissing),
  });
  if (error) {
    log("warn", "import.chunk_failed", { code: error.code, rows: parsed.data.length });
    return { ok: false, message: friendlyDbError(error) };
  }

  const result = data as { inserted: number; created_products: number; errors: RowError[] };
  log("info", "import.chunk", { inserted: result.inserted, errors: result.errors.length });
  return { ok: true, inserted: result.inserted, createdProducts: result.created_products, errors: result.errors };
}

export async function finishImport(): Promise<void> {
  refresh();
}
