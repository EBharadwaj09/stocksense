import type { Metadata } from "next";
import { headers } from "next/headers";
import { formatDate, requireOwner } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { removeMember, revokeInvite } from "../actions";
import { CopyLink } from "./CopyLink";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { shop, user } = await requireOwner();
  const supabase = await createClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("shop_members").select("user_id, role, display_name, email, created_at").eq("shop_id", shop.id).order("created_at"),
    supabase.from("shop_invites").select("id, email, created_at").eq("shop_id", shop.id).is("accepted_at", null).order("created_at"),
  ]);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const signupUrl = `${proto}://${host}/signup`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="invite-heading" className="h-fit rounded-xl border border-slate-200 bg-white p-6">
        <h1 id="invite-heading" className="text-xl font-bold text-brand-900">
          Invite staff
        </h1>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Staff can record sales and stock. Only you can change products, import data and manage the team.
        </p>
        <InviteForm />
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-2 text-sm text-slate-700">
            Then send them this link. They sign up with the invited email and tap <strong>Join shop</strong>.
          </p>
          <CopyLink url={signupUrl} />
        </div>
      </section>

      <div className="space-y-8">
        <section aria-labelledby="members-heading" className="rounded-xl border border-slate-200 bg-white">
          <h2 id="members-heading" className="border-b border-slate-200 px-5 py-4 font-semibold text-brand-900">
            Team
          </h2>
          <ul className="divide-y divide-slate-100">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {m.display_name ?? m.email}
                    {m.user_id === user.id ? <span className="font-normal text-slate-500"> (you)</span> : null}
                  </p>
                  <p className="truncate text-slate-600">
                    {m.role === "owner" ? "Owner" : "Staff"} · {m.email}
                  </p>
                </div>
                {m.role === "staff" ? (
                  <form action={removeMember}>
                    <input type="hidden" name="userId" value={m.user_id} />
                    <button type="submit" className="rounded px-2 py-1 font-medium text-red-700 hover:bg-red-50">
                      Remove<span className="sr-only"> {m.display_name ?? m.email}</span>
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pending-heading" className="rounded-xl border border-slate-200 bg-white">
          <h2 id="pending-heading" className="border-b border-slate-200 px-5 py-4 font-semibold text-brand-900">
            Pending invites
          </h2>
          {(invites ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-600">No pending invites.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(invites ?? []).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>
                    {i.email} <span className="text-slate-500">· invited {formatDate(i.created_at)}</span>
                  </span>
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="rounded px-2 py-1 font-medium text-slate-700 hover:bg-slate-100">
                      Cancel<span className="sr-only"> invite for {i.email}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
