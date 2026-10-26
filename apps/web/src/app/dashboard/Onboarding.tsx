import type { ShopContext } from "@/lib/shop";
import { acceptInvite } from "./actions";
import { CreateShopForm } from "./CreateShopForm";

export function Onboarding({ name, invites }: { name: string; invites: ShopContext["pendingInvites"] }) {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-brand-900">Welcome, {name}</h1>

      {invites.length > 0 ? (
        <section aria-labelledby="invites-heading" className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-5">
          <h2 id="invites-heading" className="font-semibold text-brand-900">
            You&apos;ve been invited to join a shop
          </h2>
          <ul className="mt-3 space-y-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3">
                <span className="text-sm text-slate-700">Invited as staff on {new Date(invite.created_at).toLocaleDateString("en-IN")}</span>
                <form action={acceptInvite}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                    Join shop
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="create-heading" className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 id="create-heading" className="font-semibold text-brand-900">
          {invites.length > 0 ? "Or set up your own shop" : "Set up your shop"}
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">You&apos;ll be the owner. You can invite staff afterwards.</p>
        <CreateShopForm />
      </section>
    </div>
  );
}
