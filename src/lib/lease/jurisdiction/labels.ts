import type { LeaseJurisdiction } from "@/lib/lease/jurisdiction/types";

/** UI terminology by region (break panel, exports, next-action copy). */
export type JurisdictionLabelPack = Readonly<{
  tenancyEnd: string;
  landlordParty: string;
  deedOfSurrender: string;
  landlordConfirmation: string;
  rentReview: string;
  breakOption: string;
}>;

const PACKS: Record<LeaseJurisdiction, JurisdictionLabelPack> = {
  uk: {
    tenancyEnd: "Tenancy ends",
    landlordParty: "Landlord or agent",
    deedOfSurrender: "Deed of surrender",
    landlordConfirmation: "Landlord or agent written confirmation",
    rentReview: "Rent review",
    breakOption: "Break option",
  },
  us: {
    tenancyEnd: "Lease ends",
    landlordParty: "Lessor",
    deedOfSurrender: "Surrender agreement",
    landlordConfirmation: "Lessor written acknowledgment",
    rentReview: "Rent adjustment / escalation",
    breakOption: "Early termination option",
  },
  eu: {
    tenancyEnd: "Lease ends",
    landlordParty: "Landlord",
    deedOfSurrender: "Surrender / termination agreement",
    landlordConfirmation: "Landlord written confirmation",
    rentReview: "Rent review / indexation",
    breakOption: "Break / termination option",
  },
  apac: {
    tenancyEnd: "Lease ends",
    landlordParty: "Landlord",
    deedOfSurrender: "Surrender / termination deed",
    landlordConfirmation: "Landlord written confirmation",
    rentReview: "Rent review",
    breakOption: "Break option",
  },
  other: {
    tenancyEnd: "Lease ends",
    landlordParty: "Landlord / lessor",
    deedOfSurrender: "Surrender or termination agreement",
    landlordConfirmation: "Counterparty written confirmation",
    rentReview: "Rent review",
    breakOption: "Break / termination option",
  },
};

export function labelsForJurisdiction(jurisdiction: LeaseJurisdiction): JurisdictionLabelPack {
  return PACKS[jurisdiction];
}
