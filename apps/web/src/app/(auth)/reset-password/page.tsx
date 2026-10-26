import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the reset email (via /auth/callback, which signs the user in for this step). */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <h1 className="text-2xl font-bold text-brand-900">Reset link needed</h1>
        <p className="mt-2 text-sm text-slate-600">
          Open the link from your reset email to choose a new password. Links expire after an hour.
        </p>
        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand-700 underline underline-offset-2">
            Send me a new link
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-brand-900">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">For {user.email}. You&apos;ll stay signed in afterwards.</p>
      <ResetPasswordForm />
    </>
  );
}
