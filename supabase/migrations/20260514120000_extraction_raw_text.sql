-- Raw PDF text and last extraction error for pipeline / UI.
alter table public.leases add column if not exists extraction_error text;

comment on column public.leases.extraction_error is 'Last text-extraction failure message, if any.';

alter table public.extracted_data add column if not exists raw_text text;

comment on column public.extracted_data.raw_text is 'Full raw text extracted from the lease PDF (when available).';
