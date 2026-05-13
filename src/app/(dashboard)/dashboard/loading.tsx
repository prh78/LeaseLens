export default function DashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div>
        <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-9 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-4 w-full max-w-[12rem] animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mt-6 space-y-3">
              {[1, 2, 3, 4].map((r) => (
                <div key={r} className="h-10 w-full animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((r) => (
              <div key={r} className="h-14 w-full animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
