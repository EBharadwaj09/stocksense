"use client";

import { useActionState } from "react";
import { Field, SelectField } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { recordSale, type ActionState } from "../actions";

export function RecordSaleForm({ products, today }: { products: { value: string; label: string }[]; today: string }) {
  const [state, action] = useActionState(recordSale, {} as ActionState);
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Quantity" name="quantity" inputMode="decimal" defaultValue={state.savedAt ? "" : state.values?.quantity} error={e.quantity} />
        <Field
          label="Price per unit (₹)"
          name="unitPrice"
          inputMode="decimal"
          required={false}
          defaultValue={state.savedAt ? "" : state.values?.unitPrice}
          error={e.unitPrice}
        />
        <Field label="Date" name="soldOn" type="date" max={today} defaultValue={state.values?.soldOn ?? today} error={e.soldOn} />
      </div>
      <SubmitButton pendingText="Saving…">Record sale</SubmitButton>
    </form>
  );
}
