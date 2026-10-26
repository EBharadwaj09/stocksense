import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-brand-900">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Free while we&apos;re in early access.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 underline underline-offset-2">
          Log in
        </Link>
      </p>
    </>
  );
}
