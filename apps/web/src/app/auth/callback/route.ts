import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/log";
import { safeRedirectPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/** Landing point for Supabase email links: sign-up confirmation and password reset (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    log("warn", "auth.callback_failed", { code: error.code, status: error.status });
  }

  // A used or expired password-reset link goes back to the reset request page.
  if (next === "/reset-password") return NextResponse.redirect(new URL("/forgot-password?error=expired", origin));
  return NextResponse.redirect(new URL("/login?error=confirm_failed", origin));
}
