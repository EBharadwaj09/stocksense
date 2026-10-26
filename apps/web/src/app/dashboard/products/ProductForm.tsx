"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { saveProduct, type ActionState } from "../actions";

export type ProductFormValues = {
  id?: string;
  name: string;
  sku: string;
  unit: string;
  price: string;
  cost: string;
  reorderPoint: string;
  leadTimeDays: string;
};

export function ProductForm({ initial }: { initial: ProductFormValues }) {
  const [state, action] = useActionState(saveProduct, {} as ActionState);
  const v = (key: keyof ProductFormValues) => state.values?.[key] ?? initial[key] ?? "";
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Field label="Product name" name="name" defaultValue={v("name")} error={e.name} placeholder="e.g. Tata Tea 1kg" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Code / SKU" name="sku" required={false} defaultValue={v("sku")} error={e.sku} hint="Used to match spreadsheet imports." />
        <Field label="Unit" name="unit" defaultValue={v("unit")} error={e.unit} hint="pcs, kg, litre, box…" />
        <Field label="Selling price (₹)" name="price" inputMode="decimal" required={false} defaultValue={v("price")} error={e.price} />
        <Field label="Cost price (₹)" name="cost" inputMode="decimal" required={false} defaultValue={v("cost")} error={e.cost} />
        <Field
          label="Reorder when stock reaches"
          name="reorderPoint"
          inputMode="numeric"
          defaultValue={v("reorderPoint")}
          error={e.reorderPoint}
          hint="0 turns off the low-stock alert."
        />
        <Field
          label="Supplier delivery time (days)"
          name="leadTimeDays"
          inputMode="numeric"
          defaultValue={v("leadTimeDays")}
          error={e.leadTimeDays}
          hint="Used later to time reorder suggestions."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-auto">
          <SubmitButton pendingText="Saving…">{initial.id ? "Save changes" : "Add product"}</SubmitButton>
        </div>
        <Link href="/dashboard/products" className="font-medium text-slate-700 underline underline-offset-2">
          Cancel
        </Link>
      </div>
    </form>
  );
}
