import { redirect } from "next/navigation";
import { cache } from "react";
import type { Database, ShopRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type Shop = Database["public"]["Tables"]["shops"]["Row"];
type Invite = Database["public"]["Tables"]["shop_invites"]["Row"];

export type ShopContext = {
  user: { id: string; email: string; name: string };
  shop: Shop | null;
  role: ShopRole | null;
  pendingInvites: (Invite & { shopName: string | null })[];
};

/**
 * The signed-in user, their shop and role. Cached per request.
 * Redirects to /login when signed out. Row-level security in the database is
 * the real access control; role checks in the app only shape the UI.
 */
export const getShopContext = cache(async (): Promise<ShopContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const email = user.email ?? "";
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : email;

  const { data: membership, error } = await supabase
    .from("shop_members")
    .select("shop_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load membership: ${error.message}`);

  let shop: Shop | null = null;
  if (membership) {
    const { data, error: shopError } = await supabase.from("shops").select("*").eq("id", membership.shop_id).single();
    if (shopError) throw new Error(`Could not load shop: ${shopError.message}`);
    shop = data;
  }

  let pendingInvites: ShopContext["pendingInvites"] = [];
  if (!shop) {
    const { data: invites } = await supabase
      .from("shop_invites")
      .select("*")
      .eq("email", email.toLowerCase())
      .is("accepted_at", null);
    // Invitees can't read the shop row until they join, so the name is unknown here.
    pendingInvites = (invites ?? []).map((i) => ({ ...i, shopName: null }));
  }

  return {
    user: { id: user.id, email, name },
    shop,
    role: membership?.role ?? null,
    pendingInvites,
  };
});

/** For pages that need a shop: sends users without one back to /dashboard. */
export async function requireShop(): Promise<ShopContext & { shop: Shop; role: ShopRole }> {
  const ctx = await getShopContext();
  if (!ctx.shop || !ctx.role) redirect("/dashboard");
  return ctx as ShopContext & { shop: Shop; role: ShopRole };
}

/** For owner-only pages. */
export async function requireOwner() {
  const ctx = await requireShop();
  if (ctx.role !== "owner") redirect("/dashboard");
  return ctx;
}

export function formatMoney(value: number | null | undefined, currency = "INR"): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function formatQty(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}
