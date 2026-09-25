import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "./brand";
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main id="conteudo" className="auth-layout">
      <aside className="auth-image">
        <Image
          src="/images/residencia.jpg"
          fill
          sizes="50vw"
          alt="Residência moderna com piscina"
          priority
        />
        <Brand />
        <div>
          <p className="eyebrow">UM NOVO OLHAR PARA CADA IMÓVEL</p>
          <h2>
            Boas experiências
            <br />
            abrem portas.
          </h2>
          <p>
            Seu portfólio, suas histórias e novas possibilidades. Tudo em um só
            lugar.
          </p>
        </div>
      </aside>
      <section className="auth-panel">
        <div>
          <Link href="/" className="auth-back">
            <ArrowLeft size={15} /> Voltar ao site
          </Link>
          <h1>{title}</h1>
          <p>{description}</p>
          {children}
          <div className="auth-bottom">
            Ainda não conhece o ImobView?{" "}
            <Link href="/demonstracao">Explore a demonstração ↗</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
