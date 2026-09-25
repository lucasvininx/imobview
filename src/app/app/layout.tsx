import { Brand } from "@/components/brand";
import { AppNavigation } from "@/components/app-navigation";
import { LogoutButton } from "@/features/auth/logout-button";
import { requireWorkspace } from "@/server/session";
export const metadata = {
  title: "Sua plataforma",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, membership } = await requireWorkspace();
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-name">
          {membership.organization.name}
          <small>Seu espaço de trabalho</small>
        </div>
        <AppNavigation />
        <div className="sidebar-bottom">
          <span>
            Uma nova perspectiva.
            <br />
            Todos os dias.
          </span>
          <LogoutButton />
        </div>
      </aside>
      <div className="app-body">
        <header className="app-topbar">
          <span>SEU PORTFÓLIO, SOB UM NOVO OLHAR.</span>
          <div className="mobile-app-brand">
            <Brand />
          </div>
          <div>
            <span>{user.name}</span>
            <span className="avatar" aria-hidden="true">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="conteudo" className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
