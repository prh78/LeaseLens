import { LeaseUploadForm } from "@/components/leases/lease-upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Upload a lease</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add a property and PDF; we store the file securely and queue it for extraction.
        </p>
      </div>

      <LeaseUploadForm />
    </div>
  );
}
