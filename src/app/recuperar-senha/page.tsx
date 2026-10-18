import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/features/auth/password-form";
import { readEnv } from "@/config/env";
export const metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: false },
};
export default function Page() {
  const enabled = readEnv().SMTP_ENABLED === "true";
  return (
    <AuthShell
      title="Vamos recuperar seu acesso."
      description={
        enabled
          ? "Informe seu e-mail e enviaremos um link para você criar uma nova senha."
          : "O envio de e-mails ainda não está disponível neste ambiente."
      }
    >
      {enabled ? (
        <PasswordForm />
      ) : (
        <p role="status" className="notice">
          A recuperação de senha ficará disponível após a configuração do
          serviço de e-mail. Entre em contato com o responsável pela sua conta.
        </p>
      )}
    </AuthShell>
  );
}
