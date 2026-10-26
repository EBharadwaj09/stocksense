/**
 * Reorder rules, from the nightly forecast (expected units sold per day, starting today).
 *
 * - Order now:  stock won't last until a new order arrives (lead time), keeping the reorder point as a safety buffer.
 * - Order soon: stock covers the lead time but not one more week after it.
 * - Suggested quantity tops stock up to: demand over (lead time + 1 week) + reorder point.
 */

export const COVER_DAYS = 7;

export type ReorderStatus = "order_now" | "order_soon" | "ok" | "no_forecast";

export type ReorderInput = {
  onHand: number;
  leadTimeDays: number;
  reorderPoint: number;
  forecast: number[]; // units per day, index 0 = today
};

export type ReorderPlan = {
  status: ReorderStatus;
  perDay: number; // average forecast units per day
  next7Days: number;
  leadTimeDemand: number;
  daysLeft: number | null; // days until stock runs out at forecast pace; null = no forecast or no demand
  suggestedQty: number;
};

/** Expected units sold over the next `days` days; beyond the forecast, the average daily rate continues. */
export function demandOver(forecast: number[], days: number): number {
  if (forecast.length === 0 || days <= 0) return 0;
  const whole = Math.floor(days);
  const known = forecast.slice(0, whole).reduce((a, b) => a + b, 0);
  const avg = forecast.reduce((a, b) => a + b, 0) / forecast.length;
  const extra = Math.max(0, whole - forecast.length) * avg + (days - whole) * avg;
  return known + extra;
}

/** Whole days of sales the current stock covers (0 = runs out today). */
export function daysOfStock(onHand: number, forecast: number[]): number | null {
  if (forecast.length === 0) return null;
  const avg = forecast.reduce((a, b) => a + b, 0) / forecast.length;
  if (onHand <= 0) return 0;
  let left = onHand;
  for (let d = 0; d < forecast.length; d++) {
    left -= forecast[d];
    if (left < 0) return d;
  }
  if (avg <= 0) return null;
  return forecast.length + Math.floor(left / avg);
}

export function planReorder(p: ReorderInput, coverDays = COVER_DAYS): ReorderPlan {
  const onHand = Math.max(0, p.onHand);
  if (p.forecast.length === 0) {
    return { status: "no_forecast", perDay: 0, next7Days: 0, leadTimeDemand: 0, daysLeft: null, suggestedQty: 0 };
  }
  const perDay = p.forecast.reduce((a, b) => a + b, 0) / p.forecast.length;
  const leadTimeDemand = demandOver(p.forecast, p.leadTimeDays);
  const target = demandOver(p.forecast, p.leadTimeDays + coverDays) + p.reorderPoint;

  let status: ReorderStatus = "ok";
  if (onHand <= leadTimeDemand + p.reorderPoint && (leadTimeDemand > 0 || p.reorderPoint > 0)) status = "order_now";
  else if (onHand <= target && target > 0) status = "order_soon";

  return {
    status,
    perDay,
    next7Days: demandOver(p.forecast, 7),
    leadTimeDemand,
    daysLeft: daysOfStock(onHand, p.forecast),
    suggestedQty: status === "ok" ? 0 : Math.max(0, Math.ceil(target - onHand)),
  };
}

const ORDER: Record<ReorderStatus, number> = { order_now: 0, order_soon: 1, ok: 2, no_forecast: 3 };

/** Most urgent first; within a status, fewest days left first. */
export function compareUrgency(a: ReorderPlan, b: ReorderPlan): number {
  return ORDER[a.status] - ORDER[b.status] || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
}
