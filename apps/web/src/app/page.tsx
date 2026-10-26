import Link from "next/link";
import { Logo } from "@/components/Logo";

const features = [
  { title: "Know what's selling", body: "Record sales and stock in seconds, or import last year's sales from a spreadsheet." },
  { title: "See the next two weeks", body: "A demand forecast for every product, with a range so you know how sure it is." },
  { title: "Reorder on time", body: "A daily list of products likely to run out before your supplier can deliver." },
];

export default function HomePage() {
  return (
    <>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-2 text-sm font-medium">
          <Link href="/login" className="rounded-md px-3 py-2 text-brand-900 hover:bg-brand-50">
            Log in
          </Link>
          <Link href="/signup" className="rounded-md bg-brand-600 px-3 py-2 text-white hover:bg-brand-700">
            Start free
          </Link>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <section className="py-14 sm:py-20">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
            Stop running out of your best sellers.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            StockSense tracks your shop&apos;s stock and sales, forecasts demand, and tells you what to reorder and when.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Create your free account
            </Link>
            <Link href="/login" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50">
              I already have an account
            </Link>
          </div>
        </section>

        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="sr-only">
            Features
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {features.map((f) => (
              <li key={f.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-brand-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
