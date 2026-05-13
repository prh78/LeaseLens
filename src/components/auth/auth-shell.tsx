import Link from "next/link";

type AuthShellProps = Readonly<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkLabel: string;
  footerLinkHref: string;
}>;

export function AuthShell({
  title,
  subtitle,
  children,
  footerText,
  footerLinkLabel,
  footerLinkHref,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-white px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">LeaseLens</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>

        {children}

        <p className="mt-6 text-sm text-slate-600">
          {footerText}{" "}
          <Link href={footerLinkHref} className="font-medium text-slate-900 hover:text-slate-700">
            {footerLinkLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}
