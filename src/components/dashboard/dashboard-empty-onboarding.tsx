import Link from "next/link";

/**
 * First-time dashboard experience when the workspace has no leases yet.
 */
export function DashboardEmptyOnboarding() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_12px_40px_-12px_rgba(15,23,42,0.12)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_15%_-10%,rgba(59,130,246,0.07),transparent_55%),radial-gradient(700px_380px_at_100%_0%,rgba(15,23,42,0.04),transparent_50%)]"
        aria-hidden
      />
      <div className="relative grid gap-10 p-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-12 sm:p-10 lg:p-12">
        <div className="min-w-0 space-y-6">
          <p className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Get started
          </p>
          <div className="space-y-4">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-[1.75rem] lg:leading-tight">
              Upload your first lease
            </h2>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
              Analyse commercial lease PDFs and surface critical dates, break clauses, and hidden risks instantly.
            </p>
          </div>
          <div className="pt-1">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Upload Lease
            </Link>
          </div>
        </div>
        <div className="hidden sm:flex sm:justify-end" aria-hidden>
          <div className="relative flex size-36 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white shadow-inner lg:size-40">
            <div className="absolute inset-2 rounded-xl bg-white/60 backdrop-blur-[2px]" />
            <svg
              viewBox="0 0 48 48"
              className="relative size-20 text-slate-400 lg:size-24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 8h14l8 8v26a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" className="text-slate-300" />
              <path d="M28 8v8h8" className="text-slate-300" />
              <path d="M16 24h16M16 28h12M16 32h14" className="text-slate-400" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
