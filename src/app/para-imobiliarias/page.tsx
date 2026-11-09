import Link from "next/link";
import {
  Building2,
  Scan,
  ContactRound,
  ChartColumn,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  Check,
  Megaphone,
  Sparkles,
  Target,
  MessageCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Para imobiliárias e corretores",
  description:
    "Conheça o portal de anúncios, tours 360°, Leads, CRM e Analytics da ImobView. No Premium, imóveis selecionados podem participar de campanhas de tráfego pago como cortesia.",
};

const features = [
  {
    icon: Building2,
    label: "PUBLICAÇÃO E DESCOBERTA",
    title: "Um portal para seus imóveis",
    text: "Coloque suas ofertas de venda e locação no caminho de quem está procurando um novo endereço.",
    items: [
      "Apresente fotos, valor, bairro, cidade e características para ajudar o cliente a entender a oferta.",
      "Seja encontrado por buscas como “casa em Campinas com 3 quartos” e por filtros de tipo, valor, quartos, banheiros e vagas.",
      "Compartilhe a página do imóvel e receba contatos de interessados pela imobiliária responsável.",
    ],
    example:
      "Na prática: quem procura um imóvel para alugar encontra seu anúncio, conhece as informações e pode conversar com sua equipe.",
  },
  {
    icon: Scan,
    label: "APRESENTAÇÃO DO IMÓVEL",
    title: "Visitas que começam online",
    text: "Ajude o cliente a conhecer os espaços antes de combinar uma visita presencial.",
    items: [
      "Organize as fotos do imóvel e crie tours com imagens panorâmicas 360° para explorar os ambientes.",
      "Conecte os espaços com setas e, quando houver planta cadastrada, permita que o visitante escolha o ambiente por ela.",
      "Receba o cadastro de quem acessa o tour e solicitações de visita para sua equipe combinar o próximo passo.",
    ],
    example:
      "Na prática: o interessado pode conhecer a sala, os quartos e a distribuição dos espaços pelo link do imóvel.",
  },
  {
    icon: ContactRound,
    label: "RELACIONAMENTO E NEGOCIAÇÃO",
    title: "Leads e CRM, cada um no seu lugar",
    text: "Mantenha sua base de clientes organizada e acompanhe o andamento de cada oportunidade.",
    items: [
      "Reúna os contatos recebidos pelo portal e pelos tours, além dos clientes cadastrados pela sua equipe.",
      "Complete o cadastro, associe o imóvel e o corretor responsável e registre informações do atendimento.",
      "Arraste as oportunidades entre as etapas do CRM, da chegada do contato à visita, proposta e fechamento.",
    ],
    example:
      "Na prática: um contato que chegou pelo tour continua na sua base e pode avançar no funil conforme o atendimento acontece.",
  },
  {
    icon: ChartColumn,
    label: "INTERESSE E RESULTADOS",
    title: "Dados para decidir",
    text: "Entenda o que desperta interesse e organize as prioridades de atendimento com mais contexto.",
    items: [
      "Acompanhe captação de contatos, visitas aos tours, solicitações presenciais, simulações e resultados registrados pela equipe.",
      "Consulte ambientes explorados e tempo de permanência quando o visitante autorizar a medição.",
      "Veja leads classificados como frios, mornos ou quentes, com os comportamentos que explicam a pontuação.",
    ],
    example:
      "Na prática: a pontuação considera permanência a partir de 15 segundos por ambiente. Passagens rápidas não somam esse interesse.",
  },
];

const journey = [
  {
    icon: Building2,
    title: "Seu imóvel é encontrado",
    text: "Anúncios de venda e locação no portal.",
  },
  {
    icon: Scan,
    title: "O cliente conhece por dentro",
    text: "Fotos e tours 360° disponíveis no anúncio.",
  },
  {
    icon: ContactRound,
    title: "O interesse vira um contato",
    text: "Cadastros organizados na sua base de Leads.",
  },
  {
    icon: ChartColumn,
    title: "Sua equipe acompanha",
    text: "Atendimento no CRM e contexto no Analytics.",
  },
];

const questions = [
  {
    title: "Posso divulgar imóveis para venda e para locação?",
    answer:
      "Sim. O portal tem buscas separadas para comprar e alugar, além de filtros para cidade, bairro, valor e características. Cada imóvel tem sua página de apresentação e formas de entrar em contato com a imobiliária responsável.",
  },
  {
    title: "Preciso ter um tour 360° para publicar um imóvel?",
    answer:
      "Não. O anúncio pode apresentar fotos e informações do imóvel. O tour 360° complementa a apresentação quando estiver disponível, permitindo explorar os ambientes antes de agendar uma visita.",
  },
  {
    title: "Como os interessados chegam até a minha equipe?",
    answer:
      "O visitante pode enviar seu contato pela página do imóvel e se cadastrar para acessar o tour, autorizando o atendimento. A página também pode oferecer WhatsApp e e-mail configurados pela imobiliária. Os cadastros recebidos ficam na base de Leads para sua equipe dar continuidade à conversa.",
  },
  {
    title: "Todo imóvel do Premium entra em campanha de tráfego pago?",
    answer:
      "A participação depende da seleção feita pela ImobView. Imobiliárias com plano Premium podem ter imóveis escolhidos para ações de marketing conforme o perfil da oferta, os materiais disponíveis e a estratégia de cada campanha. O investimento em mídia da ação selecionada é uma cortesia; as condições e o período são definidos em cada ação.",
  },
  {
    title: "Como conheço os planos e começo a usar?",
    answer:
      "Converse com a equipe da ImobView para apresentar sua operação, conhecer os planos, os limites e as condições e entender como começar. O atendimento ajuda a esclarecer as ferramentas e a participação nas campanhas do Premium antes da contratação.",
  },
];

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container professional-page">
        <section
          className="professional-hero"
          aria-labelledby="professional-title"
        >
          <div>
            <p className="eyebrow">IMOBVIEW PARA IMOBILIÁRIAS E CORRETORES</p>
            <h1 id="professional-title">
              Seu portfólio pronto para abrir <em>novas portas.</em>
            </h1>
            <p className="professional-intro">
              Anuncie imóveis para comprar e alugar, apresente cada espaço com
              tours 360° e acompanhe os contatos em uma plataforma feita para a
              rotina da sua imobiliária.
            </p>
            <div className="hero-ctas">
              <Link href="/contato" className="button button-primary">
                Quero conhecer a ImobView <ArrowUpRight size={17} />
              </Link>
              <Link href="/demonstracao" className="button button-secondary">
                Explorar demonstração <Scan size={17} />
              </Link>
            </div>
            <p className="professional-login">
              Já é cliente?{" "}
              <Link href="/login">
                Acesse sua imobiliária <ArrowRight size={14} />
              </Link>
            </p>
          </div>
          <aside
            className="professional-journey"
            aria-label="Da busca ao atendimento"
          >
            <span className="professional-journey-label">
              <Sparkles size={17} /> CADA ETAPA, MAIS PERTO
            </span>
            <h2>Da busca à próxima conversa.</h2>
            <ol>
              {journey.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <span className="professional-step-icon">
                    <Icon size={20} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <a href="#premium" className="professional-premium-link">
              <Megaphone size={18} /> Conheça a cortesia de marketing do Premium{" "}
              <ArrowRight size={16} />
            </a>
          </aside>
        </section>

        <section
          className="professional-resources"
          aria-labelledby="resources-title"
        >
          <div className="professional-section-heading">
            <p className="eyebrow">O QUE SUA IMOBILIÁRIA ENCONTRA AQUI</p>
            <h2 id="resources-title">
              Ferramentas que acompanham o seu atendimento.
            </h2>
            <p>
              Abra cada tópico para entender o que você pode fazer na
              plataforma.
            </p>
          </div>
          <div className="professional-features">
            {features.map(
              ({ icon: Icon, label, title, text, items, example }) => (
                <details className="professional-feature" key={title}>
                  <summary>
                    <span className="professional-feature-icon">
                      <Icon size={25} />
                    </span>
                    <span className="professional-feature-copy">
                      <span className="eyebrow">{label}</span>
                      <strong>{title}</strong>
                      <span>{text}</span>
                      <span className="professional-expand-label">
                        Conheça os recursos
                      </span>
                    </span>
                    <ChevronDown size={20} className="professional-chevron" />
                  </summary>
                  <div className="professional-feature-body">
                    <ul>
                      {items.map((item) => (
                        <li key={item}>
                          <Check size={17} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <p>{example}</p>
                  </div>
                </details>
              ),
            )}
          </div>
        </section>

        <section
          id="premium"
          className="professional-premium"
          aria-labelledby="premium-title"
        >
          <div className="professional-premium-copy">
            <p className="eyebrow">
              <Sparkles size={16} /> BENEFÍCIO DO PLANO PREMIUM
            </p>
            <h2 id="premium-title">
              Uma vitrine a mais para imóveis selecionados.
            </h2>
            <p>
              Com o plano Premium, sua imobiliária pode ser selecionada para
              participar de campanhas de marketing com tráfego pago da ImobView.
            </p>
            <p>
              Os imóveis escolhidos pela nossa equipe entram nas ações
              selecionadas, com o{" "}
              <strong>
                investimento em mídia oferecido como cortesia, sem custo
                adicional para a imobiliária naquela campanha.
              </strong>
            </p>
            <Link href="/contato" className="button button-primary">
              Quero conhecer o Premium <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="professional-campaign">
            <div className="professional-campaign-icon">
              <Megaphone size={32} />
            </div>
            <h3>Como funciona a cortesia</h3>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Sua imobiliária no Premium</strong>
                  <p>
                    Conheça com a equipe as condições do plano e a possibilidade
                    de participar das ações.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Curadoria da ImobView</strong>
                  <p>
                    Selecionamos os imóveis conforme o perfil da oferta, os
                    materiais e a estratégia de cada campanha.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Mais divulgação para a oferta escolhida</strong>
                  <p>
                    O imóvel selecionado participa de uma ação com mídia paga
                    custeada pela ImobView como cortesia.
                  </p>
                </div>
              </li>
            </ol>
            <p className="professional-campaign-note">
              <Target size={17} />
              <span>
                A participação está sujeita à seleção e à disponibilidade de
                campanhas. Não é automática e não abrange todos os imóveis do
                portfólio.
              </span>
            </p>
          </div>
        </section>

        <section className="professional-start" aria-labelledby="start-title">
          <div className="professional-section-heading">
            <p className="eyebrow">COMECE COM UM PRÓXIMO PASSO CLARO</p>
            <h2 id="start-title">Da sua operação para a ImobView.</h2>
          </div>
          <div className="professional-start-grid">
            {[
              [
                "01",
                "Converse com a equipe",
                "Conte sobre sua imobiliária e conheça os planos, as condições e os recursos para sua rotina.",
              ],
              [
                "02",
                "Prepare seu portfólio",
                "Cadastre os imóveis e organize as fotos, as informações de contato e os tours disponíveis.",
              ],
              [
                "03",
                "Publique e acompanhe",
                "Compartilhe seus anúncios, receba interessados e dê continuidade ao atendimento no CRM.",
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="professional-faq" aria-labelledby="faq-title">
          <div className="professional-section-heading">
            <p className="eyebrow">ANTES DA PRÓXIMA CONVERSA</p>
            <h2 id="faq-title">Dúvidas de quem quer começar.</h2>
          </div>
          <div>
            {questions.map(({ title, answer }) => (
              <details key={title}>
                <summary>
                  {title}
                  <ChevronDown size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="professional-contact"
          aria-labelledby="professional-contact-title"
        >
          <MessageCircle size={29} />
          <div>
            <p className="eyebrow">VAMOS CONHECER SUA IMOBILIÁRIA?</p>
            <h2 id="professional-contact-title">
              Entenda o que faz sentido para a sua operação.
            </h2>
            <p>
              Fale com nossa equipe sobre os recursos, os planos e a cortesia de
              campanhas do Premium.
            </p>
          </div>
          <Link href="/contato" className="button button-primary">
            Conversar com a ImobView <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
