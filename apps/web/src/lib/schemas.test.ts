import { describe, expect, it } from "vitest";
import { productSchema, saleSchema, stockSchema, todayInIndia } from "@/lib/schemas";
import { toFieldErrors } from "@/lib/validation";

const PRODUCT = "8a7d5e0c-3b1f-4c2a-9e6d-1f2a3b4c5d6e";

describe("productSchema", () => {
  const base = { name: " Tea 1kg ", sku: "TEA-1", unit: "pcs", price: "250", cost: "", reorderPoint: "5", leadTimeDays: "7" };

  it("parses a valid product and treats empty optional fields as unset", () => {
    const r = productSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({ name: "Tea 1kg", sku: "TEA-1", price: 250, reorderPoint: 5, leadTimeDays: 7 });
      expect(r.data.cost).toBeUndefined();
    }
  });

  it("turns an empty code into null", () => {
    const r = productSchema.safeParse({ ...base, sku: "  " });
    expect(r.success && r.data.sku).toBeNull();
  });

  it.each([
    ["negative price", { price: "-1" }, "price"],
    ["3-decimal price", { price: "1.234" }, "price"],
    ["fractional reorder point", { reorderPoint: "2.5" }, "reorderPoint"],
    ["lead time over a year", { leadTimeDays: "400" }, "leadTimeDays"],
    ["text price", { price: "abc" }, "price"],
    ["code with spaces", { sku: "TEA 1" }, "sku"],
  ])("rejects %s", (_l, override, field) => {
    const r = productSchema.safeParse({ ...base, ...override });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error)[field]).toBeTruthy();
  });
});

describe("saleSchema", () => {
  const base = { productId: PRODUCT, quantity: "2", unitPrice: "", soldOn: "2026-01-05" };

  it("accepts a sale and allows commas in numbers", () => {
    const r = saleSchema.safeParse({ ...base, quantity: "1,000" });
    expect(r.success && r.data.quantity).toBe(1000);
  });

  it.each([
    ["zero quantity", { quantity: "0" }, "quantity"],
    ["future date", { soldOn: "2999-01-01" }, "soldOn"],
    ["bad date", { soldOn: "05/01/2026" }, "soldOn"],
    ["missing product", { productId: "" }, "productId"],
  ])("rejects %s", (_l, override, field) => {
    const r = saleSchema.safeParse({ ...base, ...override });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error)[field]).toBeTruthy();
  });
});

describe("stockSchema", () => {
  it("allows negative quantities only for adjustments", () => {
    expect(stockSchema.safeParse({ productId: PRODUCT, reason: "adjustment", quantity: "-3", note: "" }).success).toBe(true);
    expect(stockSchema.safeParse({ productId: PRODUCT, reason: "purchase", quantity: "-3", note: "" }).success).toBe(false);
  });

  it("rejects zero", () => {
    expect(stockSchema.safeParse({ productId: PRODUCT, reason: "adjustment", quantity: "0", note: "" }).success).toBe(false);
  });
});

describe("todayInIndia", () => {
  it("rolls over at midnight India time, not UTC", () => {
    expect(todayInIndia(new Date("2026-01-05T18:29:00Z"))).toBe("2026-01-05");
    expect(todayInIndia(new Date("2026-01-05T18:31:00Z"))).toBe("2026-01-06");
  });
});
