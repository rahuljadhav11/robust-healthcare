"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/companies/${companyId}`;

  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/employees`, label: "Employees" },
    { href: `${base}/batches`, label: "Batches" },
  ];

  return (
    <nav className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
