/** Path prefixes that require a signed-in user. */
export const PROTECTED_PREFIXES = ["/dashboard"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Returns a safe same-site path to redirect to after sign-in.
 * Rejects absolute URLs, protocol-relative URLs and backslash tricks
 * so the `next` parameter can't be used as an open redirect.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  for (let i = 0; i < next.length; i++) {
    if (next.charCodeAt(i) < 0x20) return fallback; // control characters such as newlines
  }
  return next;
}
