import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="mt-6 inline-block font-semibold text-brand-700 underline underline-offset-2">
        Go to the home page
      </Link>
    </main>
  );
}
