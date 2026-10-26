import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { chunk, parseDate, parseSalesCsv, TEMPLATE_CSV } from "@/lib/import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines in fields, CRLF and BOM", () => {
    const text = '﻿name,qty\r\n"Tea, 1kg",2\r\n"Say ""hi""",3\n"Two\nlines",4\n\n';
    expect(parseCsv(text)).toEqual([
      ["name", "qty"],
      ["Tea, 1kg", "2"],
      ['Say "hi"', "3"],
      ["Two\nlines", "4"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([
      ["a", "", "c"],
      ["", "", ""],
    ]);
  });
});

describe("parseDate", () => {
  it.each([
    ["2026-01-05", "2026-01-05"],
    ["05/01/2026", "2026-01-05"],
    ["5-1-2026", "2026-01-05"],
    ["05.01.2026", "2026-01-05"],
  ])("reads %s as %s (day first)", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it.each(["31/02/2026", "2026-13-01", "yesterday", "", "01/01/1999"])("rejects %s", (input) => {
    expect(parseDate(input)).toBeNull();
  });
});

describe("parseSalesCsv", () => {
  const today = "2026-10-26";

  it("accepts the template", () => {
    const r = parseSalesCsv(TEMPLATE_CSV, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(2);
      expect(r.errors).toHaveLength(0);
      expect(r.rows[1]).toEqual({ row: 3, sku: "RICE5", name: "Rice 5kg", quantity: 1, unit_price: 320, sold_at: "2026-01-06T12:00:00Z" });
    }
  });

  it("matches common column names and reports bad rows with spreadsheet row numbers", () => {
    const csv = [
      "Sale Date,Item Code,Qty,Rate",
      "2026-01-01,A1,2,\"₹1,250\"",
      "2026-01-02,A1,0,10",
      "2099-01-01,A1,1,10",
      "not a date,A1,1,10",
      "2026-01-03,,1,10",
      "2026-01-04,A1,abc,10",
      "2026-01-05,A1,1,-5",
    ].join("\n");
    const r = parseSalesCsv(csv, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]).toMatchObject({ row: 2, sku: "A1", quantity: 2 });
      expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5, 6, 7, 8]);
    }
  });

  it("explains missing required columns", () => {
    const r = parseSalesCsv("foo,bar\n1,2\n", today);
    expect(r.ok).toBe(false);
  });

  it("validates 10,000 rows well under a second", () => {
    const lines = ["date,sku,quantity,price"];
    for (let i = 0; i < 10_000; i++) lines.push(`2026-0${(i % 9) + 1}-15,SKU${i % 200},${(i % 7) + 1},${(i % 50) + 10}`);
    const start = performance.now();
    const r = parseSalesCsv(lines.join("\n"), today);
    const ms = performance.now() - start;
    expect(r.ok && r.rows.length).toBe(10_000);
    expect(ms).toBeLessThan(1000);
  });
});

describe("chunk", () => {
  it("splits into fixed-size batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
