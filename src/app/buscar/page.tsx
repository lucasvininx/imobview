import Link from "next/link";
import { SearchX, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SearchForm } from "@/features/marketplace/search-form";
import { ListingCard } from "@/features/marketplace/listing-card";
import { searchSchema } from "@/features/marketplace/search";
import { searchMarketplace } from "@/features/marketplace/service";
import { money } from "@/lib/format";
export const metadata = {
  title: "Encontre seu próximo imóvel",
  robots: { index: false, follow: true },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const parsed = searchSchema.safeParse(params);
  const input = parsed.success ? parsed.data : searchSchema.parse({});
  const result = parsed.success ? await searchMarketplace(input) : null;
  const filters = result?.filters;
  const chips = filters
    ? [
        filters.purpose && (filters.purpose === "RENT" ? "Alugar" : "Comprar"),
        filters.type &&
          {
            HOUSE: "Casa",
            APARTMENT: "Apartamento",
            LAND: "Terreno",
            COMMERCIAL: "Comercial",
          }[filters.type],
        filters.city,
        filters.neighborhood,
        ...filters.tokens,
        filters.bedrooms && `${filters.bedrooms}+ quartos`,
        filters.bathrooms && `${filters.bathrooms}+ banheiros`,
        filters.parkingSpaces && `${filters.parkingSpaces}+ vagas`,
        filters.suites && `${filters.suites}+ suítes`,
        filters.maxPrice && `Até ${money(filters.maxPrice * 100)}`,
      ].filter(Boolean)
    : [];
  function pageUrl(page: number) {
    const query = new URLSearchParams(
      Object.entries(input).map(([key, value]) => [key, String(value)]),
    );
    query.set("page", String(page));
    return `/buscar?${query}`;
  }
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container marketplace search-page">
        <p className="eyebrow">SEU PRÓXIMO LUGAR</p>
        <h1>
          {input.purpose === "RENT"
            ? "Imóveis para alugar"
            : input.purpose === "SALE"
              ? "Imóveis à venda"
              : "Todos os imóveis"}
        </h1>
        <p>
          Explore a lista completa ou refine por cidade, bairro e
          características.
        </p>
        <SearchForm key={JSON.stringify(input)} values={input} />
        {!parsed.success && (
          <p className="form-error" role="alert">
            Confira os filtros da busca. Use valores positivos e uma descrição
            de até 300 caracteres.
          </p>
        )}
        {result && (
          <>
            <div className="results-heading">
              <div>
                <h2>
                  {result.total}{" "}
                  {result.total === 1
                    ? "imóvel encontrado"
                    : "imóveis encontrados"}
                </h2>
                <p>
                  {input.purpose === "RENT"
                    ? "Todos os imóveis publicados para locação."
                    : input.purpose === "SALE"
                      ? "Todos os imóveis publicados para compra."
                      : "Imóveis publicados por imobiliárias e corretores."}
                </p>
              </div>
              <Link
                className="text-link"
                href={
                  input.purpose ? `/buscar?purpose=${input.purpose}` : "/buscar"
                }
              >
                Limpar busca
              </Link>
            </div>
            {!!chips.length && (
              <div className="interpreted-filters">
                <span>
                  <Sparkles size={15} /> Critérios aplicados
                </span>
                {chips.map((chip, i) => (
                  <span className="filter-chip" key={i}>
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {result.items.some((item) => item.isDemo) && (
              <p className="catalog-demo-note">
                Os imóveis com selo “Demonstração” são fictícios e servem para
                explorar o sistema. Valores e imagens são ilustrativos.
              </p>
            )}
            {result.items.length ? (
              <div className="listing-grid">
                {result.items.map((listing) => (
                  <ListingCard key={listing.slug} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="market-empty">
                <SearchX size={32} />
                <h3>Nenhum imóvel nesta seleção.</h3>
                <p>
                  Tente outro bairro, amplie o orçamento ou reduza a quantidade
                  de quartos e vagas.
                </p>
                <Link className="button button-secondary" href="/buscar">
                  Ver todos os imóveis
                </Link>
              </div>
            )}
            {result.total > 12 && (
              <nav
                className="market-pagination"
                aria-label="Páginas de imóveis"
              >
                {input.page > 1 && (
                  <Link
                    className="button button-secondary"
                    href={pageUrl(input.page - 1)}
                  >
                    Anterior
                  </Link>
                )}
                <span>
                  Página {input.page} de {Math.ceil(result.total / 12)}
                </span>
                {input.page * 12 < result.total && (
                  <Link
                    className="button button-secondary"
                    href={pageUrl(input.page + 1)}
                  >
                    Próxima
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
