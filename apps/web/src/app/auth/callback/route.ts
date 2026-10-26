import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/log";
import { safeRedirectPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/** Landing point for Supabase email-confirmation links (PKCE code exchange). */
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

  return NextResponse.redirect(new URL("/login?error=confirm_failed", origin));
}
