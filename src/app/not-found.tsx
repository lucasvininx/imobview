import { ButtonLink } from "@/components/ui";
export default function NotFound() {
  return (
    <main id="conteudo" className="error-page">
      <p className="eyebrow">404 · PÁGINA NÃO ENCONTRADA</p>
      <h1>Este endereço não está disponível.</h1>
      <p>A página pode ter sido retirada ou você não tem acesso a ela.</p>
      <ButtonLink href="/">Voltar ao início</ButtonLink>
    </main>
  );
}
