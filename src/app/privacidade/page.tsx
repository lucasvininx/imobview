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
          O ImobView° conecta quem busca imóveis às imobiliárias e oferece
          ferramentas para a gestão dos contatos e atendimentos.
        </p>
        <h2>Dados utilizados nesta versão</h2>
        <p>
          Contas autorizadas utilizam nome, e-mail e credenciais protegidas pelo
          provedor de autenticação. Cookies essenciais mantêm a sessão e a
          seleção de organização. Um cookie também guarda sua preferência de
          tema claro ou escuro. O sistema de autenticação pode registrar
          endereço IP e informações do navegador para proteger o acesso.
        </p>
        <h2>Demonstração e navegação</h2>
        <p>
          Quando a interpretação por IA está habilitada, o texto digitado na
          busca é enviado à OpenAI para extrair os critérios do imóvel. Evite
          incluir dados pessoais na pesquisa. Os cadastros dos clientes não são
          enviados ao provedor por essa funcionalidade.
        </p>
        <p>
          Os imóveis demonstrativos são fictícios. Em todos os tours públicos,
          inclusive nas demonstrações, o cadastro com nome, e-mail e telefone é
          necessário antes de liberar o tour. Esses dados ficam disponíveis para
          a imobiliária responsável, mesmo sem concluir o tour ou solicitar uma
          visita presencial. O formulário de interesse do portal envia nome,
          e-mail e celular à imobiliária responsável mediante sua autorização,
          sem exigir um tour. Na área profissional, a equipe pode complementar o
          cadastro com CPF e data de nascimento fornecidos pelo cliente. Esses
          dados ficam restritos à imobiliária e não aparecem nas páginas
          públicas.
        </p>
        <p>
          A visita virtual exige autorização para a medição de comportamento,
          que começa apenas após sua escolha. Registramos ambientes abertos,
          ordem de navegação, tempo com a página visível, cliques em contato e
          compartilhamento e os valores que você informar no simulador de
          financiamento (entrada, prazo, taxa e sistema). Você pode parar a
          medição no próprio tour. A origem é limitada ao domínio de referência
          ou ao parâmetro utm_source; não armazenamos a URL completa de
          referência. Não utilizamos cookies publicitários. Uma chave temporária
          derivada do endereço de rede limita abuso dos formulários, sem guardar
          o IP em claro nesse módulo.
        </p>
        <p>
          Se você deixar seu contato, guardamos neste navegador uma chave
          aleatória que permite continuar a visita ao mesmo imóvel sem preencher
          o formulário de novo e informa à imobiliária que você voltou. A chave
          não contém seus dados, e o servidor guarda apenas uma versão
          criptográfica dela. Use &ldquo;Não sou eu&rdquo; no tour para que o
          navegador a esqueça. Se você informar o mesmo e-mail novamente para o
          mesmo imóvel, a visita é associada ao cadastro existente; dados
          diferentes ficam registrados como observação para a imobiliária, sem
          substituir os anteriores.
        </p>
        <h2>Solicitações e histórico</h2>
        <p>
          Solicitar uma visita não confirma um horário. A imobiliária combina os
          detalhes diretamente com você. Dados de contato são separados da
          autorização de medição. Para obter uma cópia ou solicitar exclusão,
          contate a imobiliária que apresentou o imóvel. A equipe autorizada
          pode exportar e excluir seu cadastro e histórico no painel.
        </p>
        <h2>Agenda e avisos de visitas</h2>
        <p>
          Quando a imobiliária habilita integrações, os dados necessários ao
          agendamento e ao atendimento podem ser enviados ao Google Agenda, ao
          WhatsApp Business da Meta e ao Resend, conforme os canais
          configurados. A conexão com o Google depende da autorização da conta
          do profissional. A imobiliária escolhe os destinatários dos avisos de
          visitas. O titular da conta Google pode desconectar ou revogar esse
          acesso. Credenciais de integração ficam criptografadas e não aparecem
          em páginas públicas.
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
