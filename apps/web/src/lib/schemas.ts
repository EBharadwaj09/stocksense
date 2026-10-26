import { z } from "zod";
import { emailSchema } from "@/lib/validation";

/** Max decimal places allowed in a numeric string. */
function hasDecimals(value: number, places: number): boolean {
  return Number.isInteger(Math.round(value * 10 ** places * 1e6) / 1e6);
}

/** A required number typed into a form field (forms always send strings). */
function numberField(label: string, opts: { min?: number; max: number; places: number; positive?: boolean }) {
  return z
    .string()
    .trim()
    .min(1, { message: `Enter ${label}.` })
    .transform((v) => Number(v.replace(/,/g, "")))
    .pipe(
      z
        .number({ message: `${capitalize(label)} must be a number.` })
        .refine((n) => Number.isFinite(n), { message: `${capitalize(label)} must be a number.` })
        .refine((n) => (opts.positive ? n > 0 : n >= (opts.min ?? 0)), {
          message: opts.positive
            ? `${capitalize(label)} must be more than 0.`
            : `${capitalize(label)} must be at least ${opts.min ?? 0}.`,
        })
        .refine((n) => n <= opts.max, { message: `${capitalize(label)} must be at most ${opts.max}.` })
        .refine((n) => hasDecimals(n, opts.places), {
          message:
            opts.places === 0
              ? `${capitalize(label)} must be a whole number.`
              : `${capitalize(label)} can have at most ${opts.places} decimal places.`,
        }),
    );
}

/** Same as numberField, but an empty field means "not set". */
function optionalNumberField(label: string, opts: { max: number; places: number }) {
  return z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(numberField(label, opts).optional());
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Enter a valid date." })
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { message: "Enter a valid date." });

/** Today's date (YYYY-MM-DD) in India time, used to reject future dates. */
export function todayInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export const shopNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Shop name must be at least 2 characters." })
    .max(80, { message: "Shop name must be at most 80 characters." }),
});

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Enter a product name." })
    .max(120, { message: "Product name must be at most 120 characters." }),
  sku: z
    .string()
    .trim()
    .max(64, { message: "Code must be at most 64 characters." })
    .regex(/^[A-Za-z0-9._-]*$/, { message: "Code can only use letters, numbers, dot, dash and underscore." })
    .transform((v) => (v === "" ? null : v)),
  unit: z
    .string()
    .trim()
    .min(1, { message: "Enter a unit, such as pcs or kg." })
    .max(16, { message: "Unit must be at most 16 characters." }),
  price: optionalNumberField("price", { max: 10_000_000, places: 2 }),
  cost: optionalNumberField("cost", { max: 10_000_000, places: 2 }),
  reorderPoint: numberField("reorder point", { min: 0, max: 1_000_000, places: 0 }),
  leadTimeDays: numberField("lead time", { min: 0, max: 365, places: 0 }),
});

export const saleSchema = z.object({
  productId: z.uuid({ message: "Choose a product." }),
  quantity: numberField("quantity", { positive: true, max: 1_000_000, places: 3 }),
  unitPrice: optionalNumberField("price", { max: 10_000_000, places: 2 }),
  soldOn: isoDate.refine((v) => v <= todayInIndia(), { message: "Date can't be in the future." }),
});

export const STOCK_REASONS = ["purchase", "opening", "adjustment"] as const;

export const stockSchema = z
  .object({
    productId: z.uuid({ message: "Choose a product." }),
    reason: z.enum(STOCK_REASONS, { message: "Choose what kind of change this is." }),
    quantity: z
      .string()
      .trim()
      .min(1, { message: "Enter quantity." })
      .transform((v) => Number(v.replace(/,/g, "")))
      .pipe(
        z
          .number({ message: "Quantity must be a number." })
          .refine((n) => Number.isFinite(n) && n !== 0, { message: "Quantity can't be 0." })
          .refine((n) => Math.abs(n) <= 1_000_000, { message: "Quantity is too large." })
          .refine((n) => hasDecimals(n, 3), { message: "Quantity can have at most 3 decimal places." }),
      ),
    note: z
      .string()
      .trim()
      .max(200, { message: "Note must be at most 200 characters." })
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((v) => v.reason === "adjustment" || v.quantity > 0, {
    message: "Quantity must be more than 0. Use an adjustment to reduce stock.",
    path: ["quantity"],
  });

export const inviteSchema = z.object({ email: emailSchema });
