import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Play,
  Scan,
  Images,
  Link2,
  Building2,
  Check,
  MousePointer2,
  Maximize,
  MapPin,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ButtonLink } from "@/components/ui";
const features = [
  {
    icon: Images,
    title: "Cada detalhe, bem apresentado.",
    description:
      "Fotos organizadas em uma galeria que valoriza os ambientes e os detalhes do imóvel.",
    tag: "GALERIA DE FOTOS",
  },
  {
    icon: Scan,
    title: "Liberdade para explorar.",
    description:
      "Tours virtuais e experiências 360° para conhecer cada espaço no próprio ritmo.",
    tag: "EXPERIÊNCIAS IMERSIVAS",
  },
  {
    icon: Link2,
    title: "Um imóvel. Um único link.",
    description:
      "Uma apresentação organizada, pronta para compartilhar onde seu cliente estiver.",
    tag: "PÁGINA COMPARTILHÁVEL",
  },
  {
    icon: Building2,
    title: "Seu portfólio em um só lugar.",
    description:
      "Organize os imóveis da sua imobiliária, prepare rascunhos e escolha o que publicar.",
    tag: "GESTÃO DO PORTFÓLIO",
  },
];
const faqs = [
  [
    "O que é o ImobView?",
    "É uma plataforma para organizar imóveis, enviar fotos e montar tours 360° com ambientes conectados em páginas compartilháveis.",
  ],
  [
    "Preciso de equipamentos especiais?",
    "Para gerenciar imóveis, basta um navegador. Para o tour, envie panoramas equiretangulares 360° × 180°, em proporção 2:1, capturados com câmera 360° ou equipamento e software de costura adequados. Fotos comuns não substituem panoramas completos.",
  ],
  [
    "Posso compartilhar pelo WhatsApp?",
    "Sim. As páginas publicadas possuem um link próprio, com título e descrição preparados para compartilhamento.",
  ],
  [
    "O ImobView já está disponível?",
    "O beta tem entrada acompanhada e condições combinadas com cada imobiliária. Explore a demonstração e fale com a equipe. Não há cobrança automática nesta etapa.",
  ],
];
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <section className="hero">
          <Image
            className="hero-image"
            src="/images/residencia.jpg"
            alt="Residência contemporânea com grandes janelas, jardim e piscina"
            fill
            priority
            sizes="100vw"
          />
          <div className="hero-shade" />
          <div className="container hero-content">
            <p className="eyebrow">
              <span className="status-dot" /> UMA NOVA PERSPECTIVA PARA O
              MERCADO IMOBILIÁRIO
            </p>
            <h1>
              A próxima visita
              <br />
              começa <span>aqui.</span>
            </h1>
            <p className="hero-description">
              Mais do que mostrar um imóvel.
              <br />
              Faça seu cliente se imaginar dentro dele.
            </p>
            <p className="hero-small">
              Fotos, tours e experiências que aproximam
              <br className="desktop-only" /> pessoas do seu próximo lugar.
            </p>
            <div className="hero-ctas">
              <ButtonLink href="/demonstracao">
                Explorar a experiência <ArrowUpRight size={18} />
              </ButtonLink>
              <ButtonLink href="#produto" variant="secondary">
                <Play size={15} /> Conhecer o ImobView
              </ButtonLink>
            </div>
            <div className="hero-note">
              <span className="line" /> TECNOLOGIA QUE VALORIZA CADA ESPAÇO.
            </div>
          </div>
          <Link href="/demonstracao" className="hero-property">
            <span className="property-preview">
              <Play size={18} fill="currentColor" />
            </span>
            <span>
              <small>SEU PRÓXIMO IMÓVEL, SOB OUTRO OLHAR</small>
              <strong>Entre. Explore. Imagine.</strong>
            </span>
            <ArrowUpRight size={20} />
          </Link>
          <a
            href="#produto"
            className="hero-scroll"
            aria-label="Explorar o produto"
          >
            <ArrowDown size={17} />
          </a>
        </section>
        <div className="promise-bar">
          <div className="container">
            <span>
              O imóvel no centro.
              <br />
              <strong>A experiência em primeiro lugar.</strong>
            </span>
            <div>
              <Images size={19} /> Imagens que envolvem
            </div>
            <div>
              <Scan size={20} /> Espaços que surpreendem
            </div>
            <div>
              <Link2 size={19} /> Conexões que aproximam
            </div>
          </div>
        </div>
        <section id="produto" className="section container product-section">
          <div className="section-copy">
            <p className="eyebrow">MENOS IMAGINAÇÃO. MAIS EXPERIÊNCIA.</p>
            <h2>
              Fotos mostram.
              <br />
              <span className="muted">Experiências</span>
              <br />
              conectam.
            </h2>
            <p>
              Uma imagem nem sempre conta a história inteira. A luz que entra
              pela janela. A conexão entre os ambientes. A sensação de estar em
              casa.
            </p>
            <p>
              Com o ImobView°, seu portfólio ganha uma nova dimensão — e cada
              visita presencial começa com muito mais interesse.
            </p>
            <Link href="/demonstracao" className="text-link">
              Veja com seus próprios olhos <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="experience-preview">
            <Image
              src="/images/living.jpg"
              alt="Sala ampla e iluminada de um apartamento demonstrativo"
              fill
              sizes="(max-width: 800px) 100vw, 50vw"
            />
            <div className="preview-top">
              <span className="preview-tag">
                <span className="status-dot" /> EXPERIÊNCIA IMOBVIEW
              </span>
              <Maximize size={18} />
            </div>
            <Link
              className="play-circle"
              href="/demonstracao"
              aria-label="Abrir apresentação demonstrativa"
            >
              <ArrowUpRight size={30} />
            </Link>
            <div className="preview-bottom">
              <div>
                <small>UM NOVO JEITO DE CONHECER</small>
                <h3>Seu próximo lugar.</h3>
                <span>
                  <MapPin size={13} /> Apartamento demonstrativo · São Paulo
                </span>
              </div>
              <span className="degree-mark">360°</span>
            </div>
            <div className="floating-note">
              <MousePointer2 size={17} />
              <span>
                Uma experiência.
                <br />
                <strong>Inúmeras possibilidades.</strong>
              </span>
            </div>
          </div>
        </section>
        <section id="recursos" className="section features-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">UM PORTFÓLIO COM OUTRA PRESENÇA</p>
                <h2>
                  Mais perspectivas.
                  <br />
                  Mais possibilidades.
                </h2>
              </div>
              <p>
                Uma plataforma pensada para aproximar
                <br />o seu imóvel de quem procura por ele.
              </p>
            </div>
            <div className="feature-grid">
              {features.map(({ icon: Icon, ...feature }, index) => (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-card-top">
                    <Icon size={25} />
                    <span>0{index + 1}</span>
                  </div>
                  <small>{feature.tag}</small>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <span className="feature-stage">
                    {index === 2
                      ? "Disponível na primeira versão"
                      : "No roadmap do produto"}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="como-funciona" className="section container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DO CADASTRO AO PRIMEIRO ENCANTO</p>
              <h2>
                Simples para você.
                <br />
                Marcante para seu cliente.
              </h2>
            </div>
            <ButtonLink href="/demonstracao" variant="secondary">
              Ver na prática <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
          <div className="steps">
            {[
              [
                "Organize",
                "Cadastre o imóvel e reúna os detalhes que fazem a diferença.",
              ],
              [
                "Apresente",
                "Prepare uma página com a identidade e a história do imóvel.",
              ],
              [
                "Compartilhe",
                "Publique e leve a experiência até seu cliente com um único link.",
              ],
            ].map(([title, description], i) => (
              <article key={title}>
                <span className="step-number">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="agency-banner container">
          <Image
            src="/images/interior.jpg"
            alt="Interior com arquitetura sofisticada e iluminação natural"
            fill
            sizes="100vw"
          />
          <div className="agency-copy">
            <p className="eyebrow">PARA QUEM ENXERGA ALÉM</p>
            <h2>
              Seu portfólio merece
              <br />
              uma apresentação
              <br />à altura.
            </h2>
            <p>
              Para imobiliárias, corretores e incorporadoras
              <br />
              que acreditam no poder de uma boa experiência.
            </p>
            <ButtonLink href="/contato">
              Vamos conversar <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
        </section>
        <section id="planos" className="section container">
          <div className="center-heading">
            <p className="eyebrow">ESPAÇO PARA CRESCER COM VOCÊ</p>
            <h2>Uma nova fase para o seu negócio.</h2>
            <p>
              Escolha como começar. As condições e os limites do beta são
              combinados com nossa equipe antes da contratação.
            </p>
          </div>
          <div className="plans">
            {[
              {
                name: "Conheça",
                desc: "O primeiro passo para apresentar melhor.",
                items: [
                  "Organização de imóveis",
                  "Galeria de fotos",
                  "Páginas compartilháveis",
                ],
              },
              {
                name: "Beta 360°",
                desc: "Mais formas de explorar cada espaço.",
                items: [
                  "Cadastro e apresentação de imóveis",
                  "Tours virtuais e conteúdo 360°",
                  "Contato direto por WhatsApp",
                ],
              },
              {
                name: "Seu portfólio",
                desc: "Uma visão completa para sua imobiliária.",
                items: [
                  "Todos os recursos do beta",
                  "Entrada acompanhada pela equipe",
                  "Limites acordados conforme o volume",
                ],
              },
            ].map((plan, i) => (
              <article
                className={`plan ${i === 1 ? "plan-featured" : ""}`}
                key={plan.name}
              >
                <p className="eyebrow">
                  {i === 1 ? "TOURS CONECTADOS" : "ENTRADA ACOMPANHADA"}
                </p>
                <h3>{plan.name}</h3>
                <p>{plan.desc}</p>
                <div className="plan-price">
                  Sob consulta <span>condições do beta</span>
                </div>
                <ul>
                  {plan.items.map((item) => (
                    <li key={item}>
                      <Check size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href="/contato"
                  variant={i === 1 ? "primary" : "secondary"}
                >
                  Tenho interesse <ArrowUpRight size={15} />
                </ButtonLink>
              </article>
            ))}
          </div>
        </section>
        <section id="faq" className="section container faq-section">
          <div>
            <p className="eyebrow">SEM PONTAS SOLTAS</p>
            <h2>
              Vamos esclarecer
              <br />
              suas dúvidas.
            </h2>
            <Link href="/contato" className="text-link">
              Fale com a gente <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="final-cta container">
          <p className="eyebrow">VISITAS QUE COMEÇAM ANTES DA PORTA</p>
          <h2>
            Mostre mais.
            <br />
            Desperte <span>novas possibilidades.</span>
          </h2>
          <ButtonLink href="/demonstracao">
            Conheça o ImobView° <ArrowUpRight size={18} />
          </ButtonLink>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
