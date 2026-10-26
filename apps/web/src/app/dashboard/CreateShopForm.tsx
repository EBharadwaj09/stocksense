"use client";

import { useActionState } from "react";
import { Field } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { createShop, type ActionState } from "./actions";

export function CreateShopForm() {
  const [state, action] = useActionState(createShop, {} as ActionState);
  return (
    <form action={action} noValidate className="space-y-4">
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}
      <Field label="Shop name" name="name" placeholder="e.g. Patel General Store" defaultValue={state.values?.name} error={state.fieldErrors?.name} />
      <SubmitButton pendingText="Creating shop…">Create shop</SubmitButton>
    </form>
  );
}
