import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to your LeaseLens workspace."
      footerText="Need an account?"
      footerLinkLabel="Create one"
      footerLinkHref="/signup"
    >
      <LoginForm />
    </AuthShell>
  );
}
