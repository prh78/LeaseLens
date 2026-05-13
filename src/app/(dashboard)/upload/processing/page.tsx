import { Suspense } from "react";

import { LeaseProcessingStatus } from "@/components/leases/lease-processing-status";

function ProcessingFallback() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
      <div className="h-4 w-full max-w-lg animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export default function UploadProcessingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Processing your lease</h1>
        <p className="mt-1 text-sm text-slate-600">
          This page updates automatically while we work on your document.
        </p>
      </div>

      <Suspense fallback={<ProcessingFallback />}>
        <LeaseProcessingStatus />
      </Suspense>
    </div>
  );
}
