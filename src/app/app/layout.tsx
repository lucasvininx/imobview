import { Brand } from "@/components/brand";
import { AppNavigation } from "@/components/app-navigation";
import { LogoutButton } from "@/features/auth/logout-button";
import { requireWorkspace } from "@/server/session";
import { can } from "@/domain/permissions";
import { NotificationBell } from "@/features/notifications/bell";
import { listNotifications } from "@/features/notifications/service";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-provider";
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
  const { actor, user, membership } = await requireWorkspace();
  const notifications = can(membership.role, "lead:read")
    ? await listNotifications(actor)
    : null;
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
          <Link href="/buscar">Ver portal de imóveis ↗</Link>
          <div className="mobile-app-brand">
            <Brand />
          </div>
          <div>
            <ThemeToggle />
            {notifications && (
              <NotificationBell
                key={actor.organizationId}
                workspaceId={actor.organizationId}
                initial={notifications}
              />
            )}
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
