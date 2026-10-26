import { describe, expect, it } from "vitest";
import { compareUrgency, daysOfStock, demandOver, planReorder } from "./reorder";

const flat = (perDay: number, days = 14) => Array.from({ length: days }, () => perDay);

describe("demandOver", () => {
  it("sums the forecast and extends it at the average rate", () => {
    expect(demandOver([1, 2, 3], 2)).toBe(3);
    expect(demandOver([1, 2, 3], 5)).toBe(6 + 2 * 2);
    expect(demandOver([], 5)).toBe(0);
    expect(demandOver([4], 0)).toBe(0);
  });
});

describe("daysOfStock", () => {
  it("counts whole days covered", () => {
    expect(daysOfStock(25, flat(10))).toBe(2);
    expect(daysOfStock(0, flat(10))).toBe(0);
    expect(daysOfStock(300, flat(10))).toBe(30);
    expect(daysOfStock(5, flat(0))).toBeNull();
    expect(daysOfStock(5, [])).toBeNull();
  });
});

describe("planReorder", () => {
  it("orders now when stock will not last the lead time plus buffer", () => {
    const plan = planReorder({ onHand: 50, leadTimeDays: 5, reorderPoint: 10, forecast: flat(10) });
    expect(plan.status).toBe("order_now");
    // target = 10/day × (5 + 7) + 10 = 130 → order 80
    expect(plan.suggestedQty).toBe(80);
    expect(plan.leadTimeDemand).toBe(50);
    expect(plan.daysLeft).toBe(5); // 10 a day lasts 5 full days
  });

  it("orders soon when stock covers the lead time but not the week after", () => {
    const plan = planReorder({ onHand: 100, leadTimeDays: 5, reorderPoint: 10, forecast: flat(10) });
    expect(plan.status).toBe("order_soon");
    expect(plan.suggestedQty).toBe(30);
  });

  it("is ok with plenty of stock", () => {
    const plan = planReorder({ onHand: 500, leadTimeDays: 5, reorderPoint: 10, forecast: flat(10) });
    expect(plan).toMatchObject({ status: "ok", suggestedQty: 0, perDay: 10, next7Days: 70 });
  });

  it("handles lead times longer than the 14-day forecast", () => {
    const plan = planReorder({ onHand: 100, leadTimeDays: 30, reorderPoint: 0, forecast: flat(5) });
    expect(plan.leadTimeDemand).toBe(150);
    expect(plan.status).toBe("order_now");
    expect(plan.suggestedQty).toBe(5 * 37 - 100);
  });

  it("does not ask to order products nobody buys", () => {
    expect(planReorder({ onHand: 0, leadTimeDays: 7, reorderPoint: 0, forecast: flat(0) }).status).toBe("ok");
  });

  it("treats negative stock as empty and rounds fractional units up", () => {
    const plan = planReorder({ onHand: -3, leadTimeDays: 1, reorderPoint: 0, forecast: flat(0.5) });
    expect(plan.status).toBe("order_now");
    expect(plan.suggestedQty).toBe(4); // 0.5 × 8 = 4
  });

  it("reports missing forecasts", () => {
    expect(planReorder({ onHand: 3, leadTimeDays: 7, reorderPoint: 5, forecast: [] }).status).toBe("no_forecast");
  });
});

it("sorts the most urgent first", () => {
  const plans = [
    planReorder({ onHand: 500, leadTimeDays: 5, reorderPoint: 0, forecast: flat(10) }),
    planReorder({ onHand: 20, leadTimeDays: 5, reorderPoint: 0, forecast: flat(10) }),
    planReorder({ onHand: 10, leadTimeDays: 5, reorderPoint: 0, forecast: flat(10) }),
    planReorder({ onHand: 100, leadTimeDays: 5, reorderPoint: 0, forecast: flat(10) }),
  ].sort(compareUrgency);
  expect(plans.map((p) => p.status)).toEqual(["order_now", "order_now", "order_soon", "ok"]);
  expect(plans[0].daysLeft).toBe(1);
});
