import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema, toFieldErrors } from "@/lib/validation";

describe("signUpSchema", () => {
  const valid = { fullName: "Asha Patel", email: "  Asha@Example.com ", password: "shop1234" };

  it("accepts valid input and normalizes the email", () => {
    const result = signUpSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("asha@example.com");
  });

  it.each([
    ["short password", { password: "ab1" }, "password"],
    ["password without a number", { password: "abcdefgh" }, "password"],
    ["password without a letter", { password: "12345678" }, "password"],
    ["invalid email", { email: "not-an-email" }, "email"],
    ["blank name", { fullName: " " }, "fullName"],
  ])("rejects %s", (_label, override, field) => {
    const result = signUpSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error)[field]).toBeTruthy();
  });
});

describe("signInSchema", () => {
  it("requires a password", () => {
    const result = signInSchema.safeParse({ email: "a@b.co", password: "" });
    expect(result.success).toBe(false);
  });
});
