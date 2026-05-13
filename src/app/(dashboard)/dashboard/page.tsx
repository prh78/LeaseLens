import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card
        title="Workspace"
        description="Project-level container for future lease analytics modules."
      />
      <Card
        title="Data Sources"
        description="Supabase auth and session persistence are now configured."
      />
      <Card title="API Surface" description="Versioned API routes are ready for modular growth." />
    </section>
  );
}
