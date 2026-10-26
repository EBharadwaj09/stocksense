/**
 * Stock count: the user types what is on the shelf for any number of products; we store the difference
 * from the recorded stock as stock movements ("opening" for a first count, otherwise "adjustment").
 */

export const COUNT_FIELD_PREFIX = "count:";
export const MAX_COUNT = 1_000_000;

export type CountMovement = {
  productId: string;
  quantity: number; // difference to add (negative reduces stock)
  reason: "opening" | "adjustment";
};

export type CountResult = {
  movements: CountMovement[];
  errors: Record<string, string>; // productId -> message
  unchanged: number;
};

/** Parse one typed count. Blank means "not counted". */
export function parseCount(raw: string): { value?: number; error?: string } {
  const text = raw.trim().replace(/,/g, "");
  if (text === "") return {};
  if (!/^\d+(\.\d{1,3})?$/.test(text)) {
    return { error: /^-/.test(text) ? "Count can't be negative." : "Enter a number with at most 3 decimals." };
  }
  const value = Number(text);
  if (value > MAX_COUNT) return { error: "Count is too large." };
  return { value };
}

/**
 * Turn typed counts into movements. `entries` are the form fields (only `count:<productId>` are used);
 * `onHand` is the current recorded stock for the shop's products — ids not in it are rejected.
 */
export function planStockCount(entries: Iterable<[string, string]>, onHand: Map<string, number>): CountResult {
  const movements: CountMovement[] = [];
  const errors: Record<string, string> = {};
  let unchanged = 0;
  for (const [key, raw] of entries) {
    if (!key.startsWith(COUNT_FIELD_PREFIX)) continue;
    const productId = key.slice(COUNT_FIELD_PREFIX.length);
    const { value, error } = parseCount(raw);
    if (error) {
      errors[productId] = error;
      continue;
    }
    if (value === undefined) continue;
    const current = onHand.get(productId);
    if (current === undefined) {
      errors[productId] = "Unknown product.";
      continue;
    }
    // round to the 3 decimals the database keeps, so 0.1 + 0.2 style noise never creates a movement
    const diff = Math.round((value - current) * 1000) / 1000;
    if (diff === 0) {
      unchanged++;
      continue;
    }
    movements.push({ productId, quantity: diff, reason: current === 0 && diff > 0 ? "opening" : "adjustment" });
  }
  return { movements, errors, unchanged };
}
