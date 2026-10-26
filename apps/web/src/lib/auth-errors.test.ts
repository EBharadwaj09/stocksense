import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "@/lib/auth-errors";

describe("friendlyAuthError", () => {
  it("maps wrong credentials", () => {
    expect(friendlyAuthError({ code: "invalid_credentials" })).toMatch(/incorrect/);
    expect(friendlyAuthError({ message: "Invalid login credentials" })).toMatch(/incorrect/);
  });

  it("maps rate limits", () => {
    expect(friendlyAuthError({ status: 429 })).toMatch(/Too many/);
  });

  it("never leaks unknown internal messages", () => {
    expect(friendlyAuthError({ message: "database connection pool exhausted at 10.0.0.3" })).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
