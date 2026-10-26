"use client";

import { useEffect } from "react";

export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "ui.unhandled_error", digest: error.digest }));
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Something went wrong</h1>
      <p className="mt-2 text-slate-600">
        This can happen if the site was updated while the page was open. Reloading usually fixes it.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-slate-500">Reference: {error.digest}</p> : null}
      <button
        type="button"
        // A full reload (not just re-rendering) picks up the latest deployment,
        // which fixes stale-page errors such as "Failed to find Server Action".
        onClick={() => window.location.reload()}
        className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
      >
        Reload the page
      </button>
    </main>
  );
}
