import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
export const metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return (
    <AuthShell
      title="Bom ter você de volta."
      description="Entre para dar uma nova perspectiva aos seus imóveis."
    >
      <LoginForm />
    </AuthShell>
  );
}
