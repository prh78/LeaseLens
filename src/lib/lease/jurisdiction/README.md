# International lease sketch (jurisdiction + notice units)

**Status:** Phase 1 and Phase 2 implemented.

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

### Phase 3 — Rules (optional)
1. Jurisdiction-specific break math flags (e.g. US early termination vs UK break).
2. Business-day calendar per `premises_country`.
3. Portfolio filter by `lease_jurisdiction`.

## Wiring checklist

| File | Change |
|------|--------|
| `database.types.ts` | Regenerate after migration |
| `openai-analyse.ts` | `buildAnalyseSystemPrompt(jurisdiction)` + extra JSON keys |
| `app/api/analyse/route.ts` | Pass `lease.lease_jurisdiction`; save new fields |
| `upload` / lease create | Set `lease_jurisdiction` |
| `break-clause-status.ts` / compute | Use `effectiveNoticePeriodDays()` |
| `lease-break-clause-panel.tsx` | `labelsForJurisdiction()` |
| `format-next-action-due-label.ts` | Locale param |
| `notification-settings-form.tsx` | Display locale selector |
| `lease-operative-terms.tsx` | Lease context block + locale options |

## API sketch (lease PATCH)

```json
{ "lease_jurisdiction": "us" }
```

## Analyse output example

```json
{
  "notice_period_spec": {
    "value": 6,
    "unit": "months",
    "day_basis": "calendar",
    "anchor": "before_break_date",
    "source_text": "not less than 6 months before the Break Date"
  },
  "notice_period_days": null,
  "governing_law": "State of New York",
  "premises_country": "US",
  "rent_currency": "USD"
}
```
