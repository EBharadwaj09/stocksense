"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { COUNT_FIELD_PREFIX } from "@/lib/stock-count";
import { recordStockCount, type ActionState } from "../../actions";

type Row = { id: string; name: string; unit: string; onHand: number };

const qty = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

export function StockCountForm({ products }: { products: Row[] }) {
  const [state, action] = useActionState(recordStockCount, {} as ActionState);
  const [filter, setFilter] = useState("");
  const errors = state.fieldErrors ?? {};
  const needle = filter.trim().toLowerCase();

  return (
    <form key={state.savedAt ?? 0} action={action} noValidate className="space-y-4">
      {state.notice ? <FormAlert tone="success">{state.notice}</FormAlert> : null}
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <label htmlFor="count-filter" className="text-sm font-medium text-slate-700">
            Find a product
          </label>
          <input
            id="count-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-brand-600 sm:max-w-xs"
          />
        </div>
        <ul className="divide-y divide-slate-100">
          {products.map((p) => {
            const field = `${COUNT_FIELD_PREFIX}${p.id}`;
            const error = errors[p.id];
            // hide filtered-out rows instead of removing them, so typed counts are still submitted
            const hidden = needle !== "" && !p.name.toLowerCase().includes(needle);
            return (
              <li
                key={p.id}
                className={`${hidden ? "hidden" : "flex"} flex-wrap items-center justify-between gap-3 px-5 py-3`}
              >
                <div className="min-w-0">
                  <label htmlFor={field} className="font-medium text-slate-900">
                    {p.name}
                  </label>
                  <p className="text-sm text-slate-600">
                    Recorded: {qty.format(p.onHand)} {p.unit}
                  </p>
                  {error ? (
                    <p id={`${field}-error`} className="text-sm text-red-700">
                      {error}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={field}
                    name={field}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Count"
                    defaultValue={state.savedAt ? "" : (state.values?.[field] ?? "")}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${field}-error` : undefined}
                    className={`w-28 rounded-lg border bg-white px-3 py-2 text-right text-base tabular-nums outline-none focus:border-brand-600 ${
                      error ? "border-red-600" : "border-slate-300"
                    }`}
                  />
                  <span className="w-10 text-sm text-slate-600">{p.unit}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Saving…">Save counts</SubmitButton>
      </div>
    </form>
  );
}
