import { signInDemo } from "../actions";

/** Signs in to the public demo shop with one tap. */
export function DemoButton() {
  return (
    <form action={signInDemo}>
      <button
        type="submit"
        className="w-full rounded-lg border border-brand-600 bg-white px-4 py-3 font-semibold text-brand-800 hover:bg-brand-50"
      >
        Try the live demo
      </button>
      <p className="mt-2 text-center text-xs text-slate-600">
        A sample kirana shop with a year of data. No sign-up; it resets every night.
      </p>
    </form>
  );
}
