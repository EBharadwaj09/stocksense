import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold text-brand-900">Forgot your password?</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Enter the email you sign in with and we&apos;ll send you a link to choose a new password.
      </p>
      <ForgotPasswordForm
        notice={error === "expired" ? "That reset link has expired or was already used. Request a new one." : undefined}
      />
      <div className="mt-6 space-y-3 text-sm text-slate-600">
        <p>
          <strong className="font-semibold text-slate-800">Forgot which email you used?</strong> StockSense signs you in
          with your email address (there is no separate username). Search your inboxes for the email titled
          &quot;Confirm your signup&quot;. If you are staff, ask your shop owner: the Team page lists the email they
          invited.
        </p>
        <p className="text-center">
          <Link href="/login" className="font-semibold text-brand-700 underline underline-offset-2">
            Back to log in
          </Link>
        </p>
      </div>
    </>
  );
}
