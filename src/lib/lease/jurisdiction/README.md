# International lease sketch (jurisdiction + notice units)

**Status:** Phases 1–3 implemented.

## Rollout phases

### Phase 1 — Data + extraction (done)
1. Migration `20260527120000_lease_jurisdiction_and_notice_units.sql` — apply via `supabase db push`.
2. Upload form: jurisdiction selector (default UK).
3. `lease-analyse-schema.ts`: `governing_law`, `premises_country`, `rent_currency`, `notice_period_spec`.
4. `openai-analyse.ts`: `buildAnalyseSystemPrompt(lease_jurisdiction)`.
5. Analyse route: persists new columns; `resolveNoticePeriodForStorage()` sets `notice_period_days` when confident.

### Phase 2 — UI labels + locale (done)
1. `labelsForJurisdiction(lease.lease_jurisdiction)` in break panel and PDF exports.
2. `display_locale` on user settings → `formatAppDate` / `formatAppDateTime` / `formatAppDateLong`.
3. Operative terms: “Lease context” block for `governing_law`, `premises_country`, `rent_currency`, region pack.
4. Notice line: amber banner with `source_text` when conversion is not confident.

### Phase 3 — Rules (done)
1. **`break-rules.ts`** — per region pack: break vs early termination, calendar-month notice windows (UK/EU), US end-date cap at break date.
2. **`business-days.ts`** + **`notice-math.ts`** — business-day notice walks Mon–Fri (+ US federal holidays sketch) using `premises_country`; month notice subtracts/adds calendar months when anchored before break date.
3. **Portfolio filter** — “Region pack” dropdown on dashboard filters (`lease_jurisdiction`).

## Key modules

| Module | Role |
|--------|------|
| `break-rules.ts` | Jurisdiction flags and UI hints |
| `business-days.ts` | `premises_country` → business-day locale |
| `notice-math.ts` | `breakWindowOpensIso`, `tenancyEndFromServedNotice`, projected end |
| `notice-period.ts` | Spec → day count; calendar month helpers |

## Wiring checklist

| File | Change |
|------|--------|
| `break-clause-status.ts` | Delegates to `notice-math` via `noticeMathContextFromExtracted` |
| `compute-lease-next-action.ts` | Passes jurisdiction + premises into break math |
| `fetch-dashboard-data.ts` | Loads `lease_jurisdiction`, `premises_country`, `notice_period_spec` |
| `filter-dashboard-leases.ts` | `leaseJurisdiction` filter |
| `lease-break-clause-panel.tsx` | Region hints + jurisdiction-aware dates |
