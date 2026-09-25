import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { PasswordForm } from "@/features/auth/password-form";
export const metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <AuthShell
      title="Um novo começo."
      description="Escolha uma senha segura com pelo menos 12 caracteres."
    >
      {token && !error ? (
        <PasswordForm token={token} />
      ) : (
        <p className="form-error">
          Link inválido.{" "}
          <Link href="/recuperar-senha">Solicite outro link.</Link>
        </p>
      )}
    </AuthShell>
  );
}
