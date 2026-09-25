import Link from "next/link";
import { Brand } from "./brand";
export function SiteFooter() {
  return (
    <footer className="site-footer container">
      <div className="footer-top">
        <div>
          <Brand />
          <p>Uma nova perspectiva para cada imóvel.</p>
        </div>
        <nav aria-label="Rodapé">
          <Link href="/#produto">Produto</Link>
          <Link href="/#planos">Planos</Link>
          <Link href="/contato">Contato</Link>
          <Link href="/login">Entrar</Link>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} ImobView°. Todos os direitos reservados.
        </span>
        <div>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
        </div>
        <span>Feito para o mercado imobiliário brasileiro.</span>
      </div>
    </footer>
  );
}
