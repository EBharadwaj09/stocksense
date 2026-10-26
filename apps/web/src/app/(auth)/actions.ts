"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { friendlyAuthError } from "@/lib/auth-errors";
import { log } from "@/lib/log";
import { safeRedirectPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/validation";

export type AuthState = {
  fieldErrors?: FieldErrors;
  formError?: string;
  notice?: string;
  values?: { fullName?: string; email?: string };
};

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { fullName: raw.fullName, email: raw.email };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    log("warn", "auth.signup_failed", { code: error.code, status: error.status });
    return { formError: friendlyAuthError(error), values };
  }

  log("info", "auth.signup", { userId: data.user?.id, needsConfirmation: !data.session });

  // Email confirmation turned off in Supabase: the user is already signed in.
  if (data.session) redirect("/dashboard");

  // Same message whether or not the email already had an account, so the form
  // can't be used to discover who is registered.
  return {
    notice: `We've sent a confirmation link to ${parsed.data.email}. Open it to finish creating your account.`,
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { email: raw.email };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    log("warn", "auth.signin_failed", { code: error.code, status: error.status });
    return { formError: friendlyAuthError(error), values };
  }

  redirect(safeRedirectPath(String(formData.get("next") ?? "")));
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error) {
    log("warn", "auth.reset_request_failed", { code: error.code, status: error.status });
    // Only rate limits are shown; anything else gets the normal message so the form can't reveal accounts.
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return { formError: "Too many reset emails were sent recently. Please wait an hour and try again.", values };
    }
  }
  // Same message whether or not the email has an account.
  return {
    notice: `If ${parsed.data.email} has a StockSense account, we've sent it a link to choose a new password. The link works once and expires in an hour.`,
  };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { formError: "Your reset link has expired. Request a new one below." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    log("warn", "auth.password_update_failed", { code: error.code, status: error.status });
    return { formError: friendlyAuthError(error) };
  }
  log("info", "auth.password_updated", { userId: user.id });
  redirect("/dashboard");
}
