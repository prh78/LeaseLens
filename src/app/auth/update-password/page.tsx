import { AuthShell } from "@/components/auth/auth-shell";
import { RecoverySessionHandler } from "@/components/auth/recovery-session-handler";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export default function UpdatePasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password to secure your LeaseLens account."
      footerText="Need to restart?"
      footerLinkLabel="Request another reset email"
      footerLinkHref="/forgot-password"
    >
      <RecoverySessionHandler>
        <UpdatePasswordForm />
      </RecoverySessionHandler>
    </AuthShell>
  );
}
