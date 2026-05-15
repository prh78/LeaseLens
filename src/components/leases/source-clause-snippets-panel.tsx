"use client";

import { useState } from "react";

import { humanizeKey } from "@/lib/lease/lease-detail";

type SourceClauseSnippetsPanelProps = Readonly<{
  snippets: Record<string, string>;
}>;

export function SourceClauseSnippetsPanel({ snippets }: SourceClauseSnippetsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(snippets);
  const count = entries.length;

  if (count === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        {expanded ? "Hide source clause snippets" : `Show source clause snippets (${count})`}
      </button>

      {expanded ? (
        <div className="space-y-4">
          {entries.map(([key, text]) => (
            <article
              key={key}
              className="rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{humanizeKey(key)}</h3>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
                {text}
              </pre>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
