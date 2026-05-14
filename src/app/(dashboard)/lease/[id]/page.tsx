import { notFound } from "next/navigation";

import { LeaseDetailView } from "@/components/leases/lease-detail-view";
import { LeaseStructuredAnalyseKickoff } from "@/components/leases/lease-structured-analyse-kickoff";
import { effectiveLeaseNextAction } from "@/lib/lease/effective-lease-next-action";
import { needsStructuredAnalyse } from "@/lib/lease/needs-structured-analyse";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LEASE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LeaseDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function LeaseDetailPage({ params }: LeaseDetailPageProps) {
  const { id } = await params;

  if (!LEASE_ID_RE.test(id)) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();

  const { data: lease, error: leaseError } = await supabase.from("leases").select("*").eq("id", id).maybeSingle();

  if (leaseError) {
    console.error("lease detail load:", leaseError.message);
    notFound();
  }

  if (!lease) {
    notFound();
  }

  const { data: extracted, error: extractedError } = await supabase
    .from("extracted_data")
    .select("*")
    .eq("lease_id", id)
    .maybeSingle();

  if (extractedError) {
    console.error("extracted_data load:", extractedError.message);
  }

  const { data: leaseDocuments, error: leaseDocumentsError } = await supabase
    .from("lease_documents")
    .select("*")
    .eq("lease_id", id)
    .order("upload_date", { ascending: true });

  if (leaseDocumentsError) {
    console.error("lease_documents load:", leaseDocumentsError.message);
  }

  const kickStructured = needsStructuredAnalyse(lease.extraction_status, extracted);
  const nextAction = effectiveLeaseNextAction(lease, extracted);

  return (
    <>
      <LeaseStructuredAnalyseKickoff leaseId={lease.id} enabled={kickStructured} />
      <LeaseDetailView
        lease={lease}
        extracted={extracted}
        nextAction={nextAction}
        documents={leaseDocuments ?? []}
      />
    </>
  );
}
