"use client";

import { useActionState } from "react";
import { Field } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { updatePassword, type AuthState } from "../actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, {} as AuthState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number."
        error={state.fieldErrors?.password}
      />
      <Field
        label="Repeat new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
