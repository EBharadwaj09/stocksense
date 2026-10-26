import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ message: "Enter a valid email address." }));

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters." })
  .max(72, { message: "Password must be at most 72 characters." })
  .regex(/[A-Za-z]/, { message: "Password must contain a letter." })
  .regex(/[0-9]/, { message: "Password must contain a number." });

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Enter your name (at least 2 characters)." })
    .max(80, { message: "Name must be at most 80 characters." }),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Enter your password." }),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] });

export type FieldErrors = Partial<Record<string, string>>;

/** Flattens a Zod error to the first message per field, for form display. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!out[field]) out[field] = issue.message;
  }
  return out;
}
