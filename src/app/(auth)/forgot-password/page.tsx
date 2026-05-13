import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we will send a secure reset link."
      footerText="Remember your password?"
      footerLinkLabel="Back to login"
      footerLinkHref="/login"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
