import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "./brand";
import { ButtonLink } from "./ui";
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Menu principal">
          <Link href="/#produto">O produto</Link>
          <Link href="/#como-funciona">Como funciona</Link>
          <Link href="/#recursos">Recursos</Link>
          <Link href="/#planos">Planos</Link>
        </nav>
        <div className="header-actions">
          <Link href="/login" className="login-link">
            Entrar
          </Link>
          <ButtonLink href="/demonstracao">
            Conhecer o ImobView <ArrowUpRight size={16} />
          </ButtonLink>
        </div>
        <details className="mobile-nav">
          <summary aria-label="Abrir menu">
            <Menu />
          </summary>
          <nav aria-label="Menu móvel">
            <Link href="/#produto">O produto</Link>
            <Link href="/#como-funciona">Como funciona</Link>
            <Link href="/#planos">Planos</Link>
            <Link href="/login">Entrar na plataforma</Link>
            <Link href="/demonstracao">Ver demonstração</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
