"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview", ownerOnly: false },
  { href: "/dashboard/sales", label: "Sales", ownerOnly: false },
  { href: "/dashboard/stock", label: "Stock", ownerOnly: false },
  { href: "/dashboard/reorder", label: "Reorder", ownerOnly: false },
  { href: "/dashboard/products", label: "Products", ownerOnly: false },
  { href: "/dashboard/import", label: "Import", ownerOnly: true },
  { href: "/dashboard/team", label: "Team", ownerOnly: true },
];

export function DashboardNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mb-px flex gap-1 overflow-x-auto">
      {LINKS.filter((l) => isOwner || !l.ownerOnly).map((l) => {
        const active = l.href === "/dashboard" ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
              active ? "border-brand-600 text-brand-900" : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
