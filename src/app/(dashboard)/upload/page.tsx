import { LeaseUploadForm } from "@/components/leases/lease-upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Upload documents</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          Register a new property with its primary lease, or attach supplemental instruments (deeds of variation,
          extensions, side letters, and more) to an existing lease. Files are stored securely and queued for extraction
          and merged analysis.
        </p>
      </div>

      <LeaseUploadForm />
    </div>
  );
}
