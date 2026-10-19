import { businessContact } from "@/config/business";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export const metadata = { title: "Privacidade" };
export default function Page() {
  const business = businessContact();
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
          Os imóveis demonstrativos são fictícios. Você pode visitar os tours
          sem se identificar. Se solicitar atendimento, seu nome, e-mail e
          telefone ficam disponíveis para a imobiliária responsável pelo imóvel.
          Não solicitamos CPF.
        </p>
        <p>
          A medição de comportamento é opcional e começa apenas após sua
          escolha. Registramos ambientes abertos, ordem de navegação, tempo com
          a página visível, cliques em contato e compartilhamento. Você pode
          parar a medição no próprio tour. A origem é limitada ao domínio de
          referência ou ao parâmetro utm_source; não armazenamos a URL completa
          de referência. Não utilizamos cookies publicitários. Uma chave
          temporária derivada do endereço de rede limita abuso dos formulários,
          sem guardar o IP em claro nesse módulo.
        </p>
        <h2>Solicitações e histórico</h2>
        <p>
          Solicitar uma visita não confirma um horário. A imobiliária combina os
          detalhes diretamente com você. Dados de contato são separados da
          autorização de medição. Para obter uma cópia ou solicitar exclusão,
          contate a imobiliária que apresentou o imóvel. A equipe autorizada
          pode exportar e excluir seu cadastro e histórico no painel.
        </p>
        <h2>Antes da abertura comercial</h2>
        <p>
          A identificação do controlador, o canal para solicitações de
          titulares, os prazos de retenção e a política definitiva devem ser
          publicados antes do cadastro de clientes reais. Esta página descreve o
          funcionamento atual e não substitui essa revisão.
        </p>
        <h2>Responsável e atendimento</h2>
        {business.name && (
          <p>
            {business.name}
            {business.registration ? ` · ${business.registration}` : ""}
          </p>
        )}
        {business.email ? (
          <p>
            Para suporte, acesso, exportação ou exclusão dos seus dados, entre
            em contato pelo{" "}
            <a href={`mailto:${business.email}`}>{business.email}</a>. A equipe
            confirma a identidade e a autorização antes de atender solicitações.
          </p>
        ) : (
          <p>
            O responsável deve configurar a identificação e o canal de
            atendimento antes da abertura comercial.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
