"use client";

import { useActionState } from "react";
import { Field } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { requestPasswordReset, type AuthState } from "../actions";

export function ForgotPasswordForm({ notice }: { notice?: string }) {
  const [state, formAction] = useActionState(requestPasswordReset, {} as AuthState);

  if (state.notice) return <FormAlert tone="success">{state.notice}</FormAlert>;

  return (
    <form action={formAction} noValidate className="space-y-4">
      {notice && !state.formError ? <FormAlert tone="error">{notice}</FormAlert> : null}
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
