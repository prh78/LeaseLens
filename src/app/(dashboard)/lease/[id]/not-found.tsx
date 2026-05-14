import Link from "next/link";

export default function LeaseNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Lease unavailable</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        We could not find that lease, or you do not have access to it. If you followed a link from your dashboard,
        the lease may have been removed or the link may be incorrect.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
