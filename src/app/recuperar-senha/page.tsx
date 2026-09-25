import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/features/auth/password-form";
export const metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <AuthShell
      title="Vamos recuperar seu acesso."
      description="Informe seu e-mail e enviaremos um link para você criar uma nova senha."
    >
      <PasswordForm />
    </AuthShell>
  );
}
