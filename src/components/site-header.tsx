import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "./brand";
import { ButtonLink } from "./ui";
import { ThemeToggle } from "./theme-provider";
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Menu principal">
          <Link href="/buscar">Todos os imóveis</Link>
          <Link href="/buscar?purpose=SALE">Comprar</Link>
          <Link href="/buscar?purpose=RENT">Alugar</Link>
          <Link href="/para-imobiliarias">Para imobiliárias</Link>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <Link href="/login" className="login-link">
            Área profissional
          </Link>
          <ButtonLink href="/buscar">
            Encontrar imóvel <ArrowUpRight size={16} />
          </ButtonLink>
        </div>
        <details className="mobile-nav">
          <summary aria-label="Abrir menu">
            <Menu />
          </summary>
          <nav aria-label="Menu móvel">
            <Link href="/buscar">Todos os imóveis</Link>
            <Link href="/buscar?purpose=SALE">Comprar imóvel</Link>
            <Link href="/buscar?purpose=RENT">Alugar imóvel</Link>
            <Link href="/para-imobiliarias">Para imobiliárias</Link>
            <Link href="/login">Entrar na plataforma</Link>
            <ThemeToggle />
          </nav>
        </details>
      </div>
    </header>
  );
}
