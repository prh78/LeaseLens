"use client";

import Link from "next/link";

type DashboardErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50/90 px-6 py-8 text-center">
      <h1 className="text-lg font-semibold text-red-950">Could not load dashboard</h1>
      <p className="mt-2 text-sm text-red-900/90">{error.message || "Something went wrong while loading your data."}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          Try again
        </button>
        <Link href="/upload" className="text-sm font-medium text-red-900 underline underline-offset-2">
          Go to upload
        </Link>
      </div>
    </div>
  );
}
