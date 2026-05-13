type CardProps = Readonly<{
  title: string;
  description?: string;
  children?: React.ReactNode;
}>;

export function Card({ title, description, children }: CardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
