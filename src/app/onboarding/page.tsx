import { requireSession } from "@/server/session";
import { LogoutButton } from "@/features/auth/logout-button";
export const metadata = {
  title: "Seu espaço de trabalho",
  robots: { index: false, follow: false },
};
export default async function Page() {
  await requireSession();
  return (
    <main id="conteudo" className="error-page">
      <h1>Seu espaço está sendo preparado.</h1>
      <p>
        Sua conta ainda não pertence a uma organização. Solicite ao responsável
        pelo ImobView a liberação do seu espaço.
      </p>
      <LogoutButton />
    </main>
  );
}
