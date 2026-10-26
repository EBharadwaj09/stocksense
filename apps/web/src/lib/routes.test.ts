import { describe, expect, it } from "vitest";
import { isProtectedPath, safeRedirectPath } from "@/lib/routes";

describe("isProtectedPath", () => {
  it.each(["/dashboard", "/dashboard/settings"])("protects %s", (p) => {
    expect(isProtectedPath(p)).toBe(true);
  });

  it.each(["/", "/login", "/signup", "/dashboards-public"])("leaves %s public", (p) => {
    expect(isProtectedPath(p)).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/dashboard/settings")).toBe("/dashboard/settings");
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/ok\n"])(
    "falls back for %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/dashboard");
    },
  );
});
