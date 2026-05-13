"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/upload", label: "Upload" },
  { href: "/dashboard/settings", label: "Settings" },
];

type SidebarNavProps = Readonly<{
  variant?: "sidebar" | "rail";
}>;

export function SidebarNav({ variant = "sidebar" }: SidebarNavProps) {
  const pathname = usePathname();
  const rail = variant === "rail";

  return (
    <nav
      aria-label="Main navigation"
      className={rail ? "flex gap-1 overflow-x-auto pb-0.5" : "space-y-1"}
    >
      {!rail ? (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </p>
      ) : null}
      {NAV_ITEMS.map((item) => {
        const isOverview = item.href === "/dashboard";
        const isUpload = item.href === "/upload";
        const isActive = isOverview
          ? pathname === "/dashboard"
          : isUpload
            ? pathname.startsWith("/upload")
            : pathname.startsWith(item.href);

        const base =
          "rounded-lg text-sm font-medium transition whitespace-nowrap " +
          (isActive
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900");

        const padding = rail ? "px-3 py-1.5" : "block px-3 py-2";

        return (
          <Link key={item.href} href={item.href} className={`${padding} ${base}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
