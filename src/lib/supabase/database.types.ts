export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ExtractionStatus = "uploading" | "extracting" | "analysing" | "complete" | "failed";
export type OverallRisk = "low" | "medium" | "high" | "critical";
export type AlertSentStatus = "pending" | "sent" | "skipped" | "failed";

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
