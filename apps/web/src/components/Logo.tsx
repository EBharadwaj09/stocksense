import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold text-brand-900">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none">
        <rect width="24" height="24" rx="6" fill="#12804f" />
        <path d="M6 15l4-4 3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      StockSense
    </Link>
  );
}
