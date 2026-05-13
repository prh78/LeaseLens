import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          LeaseLens
        </h1>
        <p className="mt-3 text-slate-600">
          Base scaffold is ready. Build your product features on top of this
          foundation.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Open Dashboard Shell
          </Link>
        </div>
      </section>
    </main>
  );
}
