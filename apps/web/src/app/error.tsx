"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "ui.unhandled_error", digest: error.digest }));
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Something went wrong</h1>
      <p className="mt-2 text-slate-600">Please try again. If it keeps happening, contact support.</p>
      {error.digest ? <p className="mt-2 text-xs text-slate-500">Reference: {error.digest}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </main>
  );
}
