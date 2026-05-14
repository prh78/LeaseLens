import type { ReactNode } from "react";

export function LeaseDetailSection(
  props: Readonly<{ title: string; description?: string; headerRight?: ReactNode; children: ReactNode }>,
) {
  const { title, description, headerRight, children } = props;
  return (
    <section className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          {headerRight ? <div className="shrink-0 sm:pt-0.5">{headerRight}</div> : null}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function LeaseDetailEmptyHint(props: Readonly<{ children: ReactNode }>) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
      {props.children}
    </p>
  );
}
