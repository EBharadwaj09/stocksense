import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNT, isDemoUser } from "./demo";
import { signInSchema } from "./validation";

describe("demo account", () => {
  it("is flagged only through app_metadata.demo === true", () => {
    expect(isDemoUser({ app_metadata: { demo: true } })).toBe(true);
    expect(isDemoUser({ app_metadata: { demo: "true" } })).toBe(false);
    expect(isDemoUser({ app_metadata: {} })).toBe(false);
    expect(isDemoUser({ app_metadata: null })).toBe(false);
    expect(isDemoUser(null)).toBe(false);
  });

  it("credentials pass the sign-in form's own validation", () => {
    expect(signInSchema.safeParse({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password }).success).toBe(true);
  });
});
