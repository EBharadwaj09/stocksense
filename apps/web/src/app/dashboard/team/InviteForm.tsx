"use client";

import { useActionState } from "react";
import { Field } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { inviteStaff, type ActionState } from "../actions";

export function InviteForm() {
  const [state, action] = useActionState(inviteStaff, {} as ActionState);
  return (
    <form key={state.savedAt ?? 0} action={action} noValidate className="space-y-4">
      {state.notice ? <FormAlert tone="success">{state.notice}</FormAlert> : null}
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}
      <Field
        label="Staff email"
        name="email"
        type="email"
        autoComplete="off"
        defaultValue={state.savedAt ? "" : state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingText="Inviting…">Invite staff</SubmitButton>
    </form>
  );
}
