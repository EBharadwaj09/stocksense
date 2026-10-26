import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already redirects signed-out users; this guards direct renders too.
  if (!user) redirect("/login?next=/dashboard");

  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : user.email;

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-brand-900">Welcome, {name}</h1>
        <p className="mt-1 text-slate-600">Signed in as {user.email}</p>

        <section aria-labelledby="next-steps" className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <h2 id="next-steps" className="font-semibold text-brand-900">
            Set up your shop
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Coming next: add your shop, invite staff, and import your products and past sales.
          </p>
        </section>
      </main>
    </>
  );
}
