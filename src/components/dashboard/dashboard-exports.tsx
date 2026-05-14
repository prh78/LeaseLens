const linkClassName =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/5 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

function DownloadGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0 text-slate-500" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 3a.75.75 0 0 1 .75.75v7.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.75A.75.75 0 0 1 10 3Z"
        clipRule="evenodd"
      />
      <path d="M4.75 15.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H4.75Z" />
    </svg>
  );
}

/** Workspace CSV exports (session cookie auth). */
export function DashboardExports() {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">Exports</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
        Download a portfolio lease register or a consolidated critical-dates schedule as CSV. For operative terms,
        risk flags, and the prioritised next action on a single lease, open the lease and use{" "}
        <span className="font-medium text-slate-700">Export summary (PDF)</span> in the header.
      </p>
      <ul className="mt-4 flex flex-wrap gap-3">
        <li>
          <a href="/api/export/portfolio-register" className={linkClassName} download>
            <DownloadGlyph />
            Portfolio register (CSV)
          </a>
        </li>
        <li>
          <a href="/api/export/critical-dates-schedule" className={linkClassName} download>
            <DownloadGlyph />
            Critical dates schedule (CSV)
          </a>
        </li>
      </ul>
    </section>
  );
}
