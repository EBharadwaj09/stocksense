import account from "./demo-account.json";

/**
 * The public demo account. Its credentials are deliberately public: the nightly job
 * (`ml/stocksense_ml/demo.py`) resets the account and its shop every night, and reads
 * the same JSON file, so the two can't drift apart.
 */
export const DEMO_ACCOUNT = account;

/** True for the demo account (flag set server-side in app_metadata; users cannot set it). */
export function isDemoUser(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  return user?.app_metadata?.demo === true;
}
