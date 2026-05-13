import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function SidebarNav() {
  return (
    <div>
      <nav aria-label="Dashboard navigation" className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <SignOutButton />
    </div>
  );
}
