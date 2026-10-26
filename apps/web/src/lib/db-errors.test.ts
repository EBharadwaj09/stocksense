import { describe, expect, it } from "vitest";
import { friendlyDbError } from "@/lib/db-errors";

describe("friendlyDbError", () => {
  it("explains duplicates and permission errors", () => {
    expect(friendlyDbError({ code: "23505" })).toMatch(/already exists/);
    expect(friendlyDbError({ code: "42501" })).toMatch(/permission/);
  });

  it("passes through messages raised on purpose by our database functions", () => {
    expect(friendlyDbError({ code: "P0001", message: "You can own at most 3 shops" })).toBe("You can own at most 3 shops");
  });

  it("hides unexpected internal details", () => {
    expect(friendlyDbError({ code: "XX000", message: "internal: relation foo" })).toBe("Something went wrong. Please try again.");
  });
});
