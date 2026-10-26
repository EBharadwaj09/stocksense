"use client";

import { useActionState } from "react";
import { Field } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { signUp, type AuthState } from "../actions";

const initialState: AuthState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, initialState);

  if (state.notice) {
    return (
      <FormAlert tone="success">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1">{state.notice}</p>
      </FormAlert>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}
      <Field
        label="Your name"
        name="fullName"
        autoComplete="name"
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number."
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
