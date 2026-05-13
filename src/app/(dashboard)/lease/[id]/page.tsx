import { notFound } from "next/navigation";

import { LeaseDetailView } from "@/components/leases/lease-detail-view";
import { LeaseStructuredAnalyseKickoff } from "@/components/leases/lease-structured-analyse-kickoff";
import { needsStructuredAnalyse } from "@/lib/lease/needs-structured-analyse";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LeaseDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function LeaseDetailPage({ params }: LeaseDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: lease, error: leaseError } = await supabase.from("leases").select("*").eq("id", id).maybeSingle();

  if (leaseError || !lease) {
    notFound();
  }

  const { data: extracted } = await supabase.from("extracted_data").select("*").eq("lease_id", id).maybeSingle();

  const kickStructured = needsStructuredAnalyse(lease.extraction_status, extracted);

  return (
    <>
      <LeaseStructuredAnalyseKickoff leaseId={lease.id} enabled={kickStructured} />
      <LeaseDetailView lease={lease} extracted={extracted} />
    </>
  );
}
