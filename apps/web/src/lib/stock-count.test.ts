import { describe, expect, it } from "vitest";
import { parseCount, planStockCount } from "./stock-count";

describe("parseCount", () => {
  it("accepts whole and decimal counts, commas and blanks", () => {
    expect(parseCount("12")).toEqual({ value: 12 });
    expect(parseCount(" 2.5 ")).toEqual({ value: 2.5 });
    expect(parseCount("1,200")).toEqual({ value: 1200 });
    expect(parseCount("")).toEqual({});
    expect(parseCount("0")).toEqual({ value: 0 });
  });

  it("rejects negatives, text, too many decimals and huge numbers", () => {
    expect(parseCount("-3").error).toMatch(/negative/);
    expect(parseCount("abc").error).toMatch(/number/);
    expect(parseCount("1.2345").error).toMatch(/3 decimals/);
    expect(parseCount("1e5").error).toMatch(/number/);
    expect(parseCount("2000000").error).toMatch(/too large/);
  });
});

describe("planStockCount", () => {
  const onHand = new Map([
    ["a", 0],
    ["b", 10],
    ["c", 5],
    ["d", 0.3],
  ]);

  it("stores the difference from recorded stock", () => {
    const res = planStockCount(
      [
        ["count:a", "40"], // first count
        ["count:b", "7"], // 3 missing
        ["count:c", "5"], // same
        ["count:d", "0.3"], // same, with decimals
        ["productId", "ignored"],
        ["count:zz", "1"], // not this shop's product
      ],
      onHand,
    );
    expect(res.movements).toEqual([
      { productId: "a", quantity: 40, reason: "opening" },
      { productId: "b", quantity: -3, reason: "adjustment" },
    ]);
    expect(res.unchanged).toBe(2);
    expect(res.errors).toEqual({ zz: "Unknown product." });
  });

  it("skips blanks and reports bad input per product", () => {
    const res = planStockCount(
      [
        ["count:a", ""],
        ["count:b", "-1"],
      ],
      onHand,
    );
    expect(res.movements).toEqual([]);
    expect(Object.keys(res.errors)).toEqual(["b"]);
  });

  it("can count a product down to zero", () => {
    expect(planStockCount([["count:b", "0"]], onHand).movements).toEqual([
      { productId: "b", quantity: -10, reason: "adjustment" },
    ]);
  });
});
