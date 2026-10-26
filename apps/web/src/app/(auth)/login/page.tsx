import type { Metadata } from "next";
import Link from "next/link";
import { safeRedirectPath } from "@/lib/routes";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

const NOTICES: Record<string, string> = {
  confirm_failed: "That confirmation link is invalid or has expired. Log in to get a new one, or sign up again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold text-brand-900">Log in</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Welcome back to StockSense.</p>
      <LoginForm next={safeRedirectPath(next)} notice={error ? NOTICES[error] : undefined} />
      <p className="mt-6 text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </>
  );
}
