"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  /** Match sub-routes too (e.g. /volunteer/dinner/counter highlights "Dinner"). */
  matchPrefix?: boolean;
};

export default function NavBar({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card">
      <div className="max-w-lg mx-auto grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = item.matchPrefix
            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                active ? "text-saffron" : "text-muted"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${active ? "bg-saffron" : "bg-transparent"}`}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
