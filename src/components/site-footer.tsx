import Link from "next/link";
import { Brand } from "./brand";
import { Camera } from "lucide-react";
export function SiteFooter() {
  return (
    <footer className="site-footer container">
      <div className="footer-top">
        <div>
          <Brand />
          <p>Uma nova perspectiva para cada imóvel.</p>
          <a
            className="footer-instagram"
            href="https://www.instagram.com/imobview_/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram da ImobView: @imobview_ (abre em nova aba)"
          >
            <Camera size={17} /> @imobview_
          </a>
        </div>
        <nav aria-label="Rodapé">
          <Link href="/buscar?purpose=SALE">Comprar</Link>
          <Link href="/buscar?purpose=RENT">Alugar</Link>
          <Link href="/para-imobiliarias">Para imobiliárias</Link>
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
