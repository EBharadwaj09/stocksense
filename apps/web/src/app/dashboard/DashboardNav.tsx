"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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
  const navRef = useRef<HTMLElement>(null);

  // On narrow screens the tabs scroll sideways; keep the current one in view.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label="Dashboard" className="-mb-px flex gap-0.5 overflow-x-auto sm:gap-1">
      {LINKS.filter((l) => isOwner || !l.ownerOnly).map((l) => {
        const active = l.href === "/dashboard" ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm font-medium sm:px-3 ${
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
