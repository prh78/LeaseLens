import { Fragment } from "react";

import {
  EXTRACTION_PIPELINE_STEPS,
  extractionPipelineStep,
  extractionProgressHeadline,
} from "@/lib/lease/extraction-pipeline";
import type { ExtractionStatus } from "@/lib/supabase/database.types";

type LeaseExtractionProgressProps = Readonly<{
  status: ExtractionStatus;
}>;

/**
 * Mini stepper for dashboard lease rows: five pipeline stages + failed styling.
 */
export function LeaseExtractionProgress({ status }: LeaseExtractionProgressProps) {
  if (status === "failed") {
    return (
      <div className="flex min-w-[9rem] flex-col gap-1.5">
        <div className="flex items-center gap-1" aria-hidden>
          {EXTRACTION_PIPELINE_STEPS.map((_, i) => (
            <Fragment key={i}>
              {i > 0 ? <span className="h-px w-1.5 shrink-0 bg-slate-200" /> : null}
              <span className="size-2 shrink-0 rounded-full bg-slate-200" />
            </Fragment>
          ))}
        </div>
        <p className="text-xs font-semibold text-red-700">Failed</p>
      </div>
    );
  }

  if (status === "complete") {
    return (
      <div className="flex min-w-[9rem] flex-col gap-1.5">
        <div className="flex items-center gap-1" aria-hidden>
          {EXTRACTION_PIPELINE_STEPS.map((step, i) => (
            <Fragment key={step.id}>
              {i > 0 ? <span className="h-px w-1.5 shrink-0 bg-emerald-200" /> : null}
              <span
                className="size-2 shrink-0 rounded-full bg-emerald-500"
                title={step.label}
              />
            </Fragment>
          ))}
        </div>
        <p className="text-xs font-semibold text-emerald-800">Complete</p>
      </div>
    );
  }

  const active = extractionPipelineStep(status);
  const activeIndex = active === null || active < 0 ? 0 : active;

  return (
    <div className="flex min-w-[9rem] flex-col gap-1.5">
      <div
        className="flex items-center gap-0.5"
        role="list"
        aria-label={`Extraction progress: ${extractionProgressHeadline(status)}`}
      >
        {EXTRACTION_PIPELINE_STEPS.map((step, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          return (
            <Fragment key={step.id}>
              {i > 0 ? (
                <span
                  className={`h-px w-1.5 shrink-0 ${done || current ? "bg-sky-200" : "bg-slate-200"}`}
                  aria-hidden
                />
              ) : null}
              <span
                role="listitem"
                title={step.label}
                className={`size-2 shrink-0 rounded-full transition-colors ${
                  done
                    ? "bg-emerald-500"
                    : current
                      ? "bg-sky-500 ring-2 ring-sky-300 ring-offset-1 ring-offset-white"
                      : "bg-slate-200"
                }`}
              />
            </Fragment>
          );
        })}
      </div>
      <p className="text-xs font-semibold leading-snug text-slate-800">{extractionProgressHeadline(status)}</p>
    </div>
  );
}
