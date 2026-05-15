-- break_clause_status JSON may store per-date objects when status is `served`:
-- { "status": "served", "notice_served_date": "YYYY-MM-DD", "evidence_type": "deed_of_surrender"|"landlord_confirmation", "evidence_note": "..." }

comment on column public.extracted_data.break_clause_status is
  'Map of ISO break date -> status string, or object with status (incl. served), notice_served_date, and optional evidence fields.';
