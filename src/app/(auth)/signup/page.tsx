import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your LeaseLens account"
      subtitle="Start with a secure account and scale your lease workflow."
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerLinkHref="/login"
    >
      <SignupForm />
    </AuthShell>
  );
}
