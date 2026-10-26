import { Logo } from "@/components/Logo";
import { getShopContext } from "@/lib/shop";
import { DashboardNav } from "./DashboardNav";
import { Onboarding } from "./Onboarding";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getShopContext();

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            {ctx.shop ? (
              <span className="hidden truncate rounded-md bg-brand-50 px-2 py-1 text-sm font-medium text-brand-900 sm:inline">
                {ctx.shop.name}
                <span className="font-normal text-slate-600"> · {ctx.role === "owner" ? "Owner" : "Staff"}</span>
              </span>
            ) : null}
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
        {ctx.shop ? (
          <div className="mx-auto max-w-6xl px-2 sm:px-4">
            <DashboardNav isOwner={ctx.role === "owner"} />
          </div>
        ) : null}
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {ctx.shop ? children : <Onboarding name={ctx.user.name} invites={ctx.pendingInvites} />}
      </main>
    </>
  );
}
