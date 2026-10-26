/** Maps Supabase Auth errors to plain-language messages for users. */
export function friendlyAuthError(error: { message?: string; status?: number; code?: string }): string {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (error.status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit") {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for the link.";
  }
  if (code === "same_password") {
    return "Choose a password different from your old one.";
  }
  if (code === "weak_password") {
    return "That password is too easy to guess. Try a longer one.";
  }
  return "Something went wrong. Please try again.";
}
