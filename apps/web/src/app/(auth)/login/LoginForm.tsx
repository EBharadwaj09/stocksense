"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/Field";
import { FormAlert } from "@/components/FormAlert";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn, type AuthState } from "../actions";

const initialState: AuthState = {};

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      {notice && !state.formError ? <FormAlert tone="error">{notice}</FormAlert> : null}
      {state.formError ? <FormAlert tone="error">{state.formError}</FormAlert> : null}
      <input type="hidden" name="next" value={next ?? ""} />
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
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <p className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="font-semibold text-brand-700 underline underline-offset-2">
          Forgot password or email?
        </Link>
      </p>
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
    </form>
  );
}
