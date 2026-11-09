"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Settings,
  Users,
  CalendarDays,
  ChartColumn,
  ContactRound,
  PanelsTopLeft,
  Plug,
} from "lucide-react";
const links = [
  { href: "/app", label: "Visão geral", icon: LayoutDashboard },
  { href: "/app/imoveis", label: "Imóveis", icon: Building2 },
  { href: "/app/leads", label: "Leads", icon: ContactRound },
  { href: "/app/crm", label: "CRM", icon: PanelsTopLeft },
  { href: "/app/agenda", label: "Visitas", icon: CalendarDays },
  { href: "/app/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/app/equipe", label: "Equipe", icon: Users },
  { href: "/app/integracoes", label: "Integrações", icon: Plug },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings },
];
export function AppNavigation() {
  const path = usePathname();
  return (
    <nav className="app-nav" aria-label="Navegação da plataforma">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          href={href}
          key={href}
          aria-label={label}
          aria-current={
            (href === "/app" ? path === href : path.startsWith(href))
              ? "page"
              : undefined
          }
        >
          <Icon size={18} />
          <span className="nav-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
