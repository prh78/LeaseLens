export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ExtractionStatus =
  | "uploading"
  | "extracting"
  | "analysing"
  | "calculating_risks"
  | "complete"
  | "failed";
export type OverallRisk = "low" | "medium" | "high" | "critical";
export type LeaseNextActionType = "break_notice_deadline" | "rent_review" | "lease_expiry" | "manual_review";
export type LeaseNextActionUrgency = "low" | "medium" | "high" | "critical";
export type AlertSentStatus = "pending" | "sent" | "skipped" | "failed";

export type LeaseDocumentType =
  | "primary_lease"
  | "deed_of_variation"
  | "lease_extension"
  | "side_letter"
  | "licence_to_alter"
  | "rent_review_memorandum"
  | "assignment";

export type LeaseDocumentProcessingStatus =
  | "pending"
  | "uploading"
  | "extracting_text"
  | "analysing"
  | "complete"
  | "failed";

export type Database = {
  public: {
    Tables: {
      leases: {
        Row: {
          id: string;
          user_id: string;
          property_name: string;
          property_type: string;
          file_url: string | null;
          upload_date: string;
          extraction_status: ExtractionStatus;
          overall_risk: OverallRisk;
          extraction_error: string | null;
          next_action_type: LeaseNextActionType | null;
          next_action_date: string | null;
          next_action_days_remaining: number | null;
          next_action_urgency: LeaseNextActionUrgency | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          property_name: string;
          property_type?: string;
          file_url?: string | null;
          upload_date?: string;
          extraction_status?: ExtractionStatus;
          overall_risk?: OverallRisk;
          extraction_error?: string | null;
          next_action_type?: LeaseNextActionType | null;
          next_action_date?: string | null;
          next_action_days_remaining?: number | null;
          next_action_urgency?: LeaseNextActionUrgency | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          property_name?: string;
          property_type?: string;
          file_url?: string | null;
          upload_date?: string;
          extraction_status?: ExtractionStatus;
          overall_risk?: OverallRisk;
          extraction_error?: string | null;
          next_action_type?: LeaseNextActionType | null;
          next_action_date?: string | null;
          next_action_days_remaining?: number | null;
          next_action_urgency?: LeaseNextActionUrgency | null;
        };
        Relationships: [];
      };
      lease_documents: {
        Row: {
          id: string;
          lease_id: string;
          document_type: LeaseDocumentType;
          file_url: string | null;
          upload_date: string;
          processing_status: LeaseDocumentProcessingStatus;
          supersedes_fields: Json;
          display_name: string | null;
        };
        Insert: {
          id?: string;
          lease_id: string;
          document_type: LeaseDocumentType;
          file_url?: string | null;
          upload_date?: string;
          processing_status?: LeaseDocumentProcessingStatus;
          supersedes_fields?: Json;
          display_name?: string | null;
        };
        Update: {
          id?: string;
          lease_id?: string;
          document_type?: LeaseDocumentType;
          file_url?: string | null;
          upload_date?: string;
          processing_status?: LeaseDocumentProcessingStatus;
          supersedes_fields?: Json;
          display_name?: string | null;
        };
        Relationships: [];
      };
      extracted_data: {
        Row: {
          lease_id: string;
          commencement_date: string | null;
          expiry_date: string | null;
          break_dates: Json;
          notice_period_days: number | null;
          rent_review_dates: Json;
          repairing_obligation: string | null;
          service_charge_responsibility: string | null;
          reinstatement_required: boolean | null;
          vacant_possession_required: boolean | null;
          confidence_score: number | null;
          source_snippets: Json;
          raw_text: string | null;
          conditional_break_clause: string | null;
          ambiguous_language: boolean | null;
          manual_review_recommended: boolean | null;
          field_provenance?: Json;
          change_history?: Json;
          document_conflicts?: Json;
        };
        Insert: {
          lease_id: string;
          commencement_date?: string | null;
          expiry_date?: string | null;
          break_dates?: Json;
          notice_period_days?: number | null;
          rent_review_dates?: Json;
          repairing_obligation?: string | null;
          service_charge_responsibility?: string | null;
          reinstatement_required?: boolean | null;
          vacant_possession_required?: boolean | null;
          confidence_score?: number | null;
          source_snippets?: Json;
          raw_text?: string | null;
          conditional_break_clause?: string | null;
          ambiguous_language?: boolean | null;
          manual_review_recommended?: boolean | null;
          field_provenance?: Json;
          change_history?: Json;
          document_conflicts?: Json;
        };
        Update: {
          lease_id?: string;
          commencement_date?: string | null;
          expiry_date?: string | null;
          break_dates?: Json;
          notice_period_days?: number | null;
          rent_review_dates?: Json;
          repairing_obligation?: string | null;
          service_charge_responsibility?: string | null;
          reinstatement_required?: boolean | null;
          vacant_possession_required?: boolean | null;
          confidence_score?: number | null;
          source_snippets?: Json;
          raw_text?: string | null;
          conditional_break_clause?: string | null;
          ambiguous_language?: boolean | null;
          manual_review_recommended?: boolean | null;
          field_provenance?: Json;
          change_history?: Json;
          document_conflicts?: Json;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          lease_id: string;
          alert_type: string;
          trigger_date: string;
          sent_status: AlertSentStatus;
          event_kind: string | null;
          event_date: string | null;
          horizon_days: number | null;
        };
        Insert: {
          id?: string;
          lease_id: string;
          alert_type: string;
          trigger_date: string;
          sent_status?: AlertSentStatus;
          event_kind?: string | null;
          event_date?: string | null;
          horizon_days?: number | null;
        };
        Update: {
          id?: string;
          lease_id?: string;
          alert_type?: string;
          trigger_date?: string;
          sent_status?: AlertSentStatus;
          event_kind?: string | null;
          event_date?: string | null;
          horizon_days?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
