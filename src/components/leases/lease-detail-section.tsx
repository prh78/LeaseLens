import type { ReactNode } from "react";

export function LeaseDetailSection(props: Readonly<{ title: string; description?: string; children: ReactNode }>) {
  const { title, description, children } = props;
  return (
    <section className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
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
