"use client";

import { useActionState } from "react";
import { Field, SelectField } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { recordStock, type ActionState } from "../actions";

const REASONS = [
  { value: "purchase", label: "Received from supplier" },
  { value: "opening", label: "Opening stock (first count)" },
  { value: "adjustment", label: "Correction (damage, count difference)" },
];

export function StockForm({ products }: { products: { value: string; label: string }[] }) {
  const [state, action] = useActionState(recordStock, {} as ActionState);
  const e = state.fieldErrors ?? {};

  return (
    <form key={state.savedAt ?? 0} action={action} noValidate className="space-y-4">
      {state.notice ? <FormAlert tone="success">{state.notice}</FormAlert> : null}
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}
      <SelectField
        label="Product"
        name="productId"
        options={products}
        placeholder="Choose a product"
        defaultValue={state.values?.productId}
        error={e.productId}
      />
      <SelectField label="What happened?" name="reason" options={REASONS} defaultValue={state.values?.reason ?? "purchase"} error={e.reason} />
      <Field
        label="Quantity"
        name="quantity"
        inputMode="decimal"
        defaultValue={state.savedAt ? "" : state.values?.quantity}
        error={e.quantity}
        hint="For a correction, use a minus sign to reduce stock, e.g. -2."
      />
      <Field label="Note" name="note" required={false} defaultValue={state.savedAt ? "" : state.values?.note} error={e.note} />
      <SubmitButton pendingText="Saving…">Update stock</SubmitButton>
    </form>
  );
}
