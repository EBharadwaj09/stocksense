import { parseCsv } from "@/lib/csv";

export const MAX_IMPORT_ROWS = 50_000;
export const IMPORT_CHUNK_SIZE = 1_000;

/** One validated sale ready to send to the import_sales database function. */
export type ImportRow = {
  row: number;
  sku: string | null;
  name: string | null;
  quantity: number;
  unit_price: number | null;
  sold_at: string;
};

export type RowError = { row: number; error: string };

export type ParsedImport =
  | { ok: true; rows: ImportRow[]; errors: RowError[]; totalRows: number }
  | { ok: false; message: string };

const HEADER_ALIASES: Record<keyof Omit<ImportRow, "row" | "sold_at"> | "date", string[]> = {
  date: ["date", "sold_at", "sold_on", "sale_date", "day", "bill_date"],
  sku: ["sku", "code", "product_code", "item_code", "barcode"],
  name: ["name", "product", "product_name", "item", "item_name"],
  quantity: ["quantity", "qty", "units", "quantity_sold", "units_sold"],
  unit_price: ["price", "unit_price", "rate", "selling_price", "mrp"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Parses a date written as YYYY-MM-DD, or day-first DD/MM/YYYY, DD-MM-YYYY or
 * DD.MM.YYYY (the usual format in India). Returns YYYY-MM-DD, or null.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000) return null;
  return date.toISOString().slice(0, 10);
}

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/[,₹\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Validates a CSV of past sales. `today` is YYYY-MM-DD (India time). */
export function parseSalesCsv(text: string, today: string): ParsedImport {
  const table = parseCsv(text);
  if (table.length < 2) return { ok: false, message: "The file has no data rows." };

  const headers = table[0].map(normalizeHeader);
  const col = (key: keyof typeof HEADER_ALIASES) => headers.findIndex((h) => HEADER_ALIASES[key].includes(h));
  const idx = { date: col("date"), sku: col("sku"), name: col("name"), quantity: col("quantity"), price: col("unit_price") };

  if (idx.date < 0 || idx.quantity < 0 || (idx.sku < 0 && idx.name < 0)) {
    return {
      ok: false,
      message: "The first row must have column names: date, quantity, and either sku or product. Download the template to see the format.",
    };
  }

  const dataRows = table.length - 1;
  if (dataRows > MAX_IMPORT_ROWS) {
    return { ok: false, message: `The file has ${dataRows.toLocaleString("en-IN")} rows. The limit is ${MAX_IMPORT_ROWS.toLocaleString("en-IN")} per import.` };
  }

  const rows: ImportRow[] = [];
  const errors: RowError[] = [];
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const rowNumber = i + 1; // spreadsheet row number, header is row 1
    const sku = cell(r, idx.sku) || null;
    const name = cell(r, idx.name) || null;
    const date = parseDate(cell(r, idx.date));
    const quantity = parseNumber(cell(r, idx.quantity));
    const price = parseNumber(cell(r, idx.price));

    let error: string | null = null;
    if (!sku && !name) error = "Product code or name is missing";
    else if (sku && sku.length > 64) error = "Product code is longer than 64 characters";
    else if (name && name.length > 120) error = "Product name is longer than 120 characters";
    else if (!date) error = "Date is missing or not a valid date (use YYYY-MM-DD or DD/MM/YYYY)";
    else if (date > today) error = "Date is in the future";
    else if (quantity === null || Number.isNaN(quantity)) error = "Quantity is missing or not a number";
    else if (quantity <= 0) error = "Quantity must be more than 0";
    else if (price !== null && (Number.isNaN(price) || price < 0)) error = "Price is not a valid number";

    if (error) {
      errors.push({ row: rowNumber, error });
    } else {
      rows.push({ row: rowNumber, sku, name, quantity: quantity!, unit_price: price, sold_at: `${date}T12:00:00Z` });
    }
  }

  return { ok: true, rows, errors, totalRows: dataRows };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const TEMPLATE_CSV = "date,sku,product,quantity,price\n2026-01-05,TEA1,Tea 1kg,3,250\n06/01/2026,RICE5,Rice 5kg,1,320\n";
