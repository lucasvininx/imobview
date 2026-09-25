import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export const metadata = { title: "Privacidade" };
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container legal-page">
        <p className="eyebrow">TRANSPARÊNCIA DESDE O INÍCIO</p>
        <h1>Privacidade</h1>
        <p>
          Esta versão do ImobView° está em desenvolvimento e destinada a
          demonstração e testes autorizados.
        </p>
        <h2>Dados utilizados nesta versão</h2>
        <p>
          Contas autorizadas utilizam nome, e-mail e credenciais protegidas pelo
          provedor de autenticação. Cookies essenciais mantêm a sessão e a
          seleção de organização. O sistema de autenticação também pode
          registrar endereço IP e informações do navegador para proteger o
          acesso.
        </p>
        <h2>Demonstração e navegação</h2>
        <p>
          Os imóveis demonstrativos são fictícios. Não implementamos cookies
          publicitários, captação de leads ou rastreamento de interações nesta
          etapa.
        </p>
        <h2>Antes da abertura comercial</h2>
        <p>
          A identificação do controlador, o canal para solicitações de
          titulares, os prazos de retenção e a política definitiva devem ser
          publicados antes do cadastro de clientes reais. Esta página descreve o
          funcionamento atual e não substitui essa revisão.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
