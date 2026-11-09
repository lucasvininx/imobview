import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import type { SearchInput } from "./search";
import Link from "next/link";
import Form from "next/form";
export function SearchForm({ values }: { values?: SearchInput }) {
  return (
    <Form action="/buscar" className="market-search">
      <div
        className="search-purpose"
        role="navigation"
        aria-label="Catálogo de imóveis"
      >
        {[
          ["", "Todos"],
          ["SALE", "Comprar"],
          ["RENT", "Alugar"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/buscar?purpose=${value}` : "/buscar"}
            aria-current={
              (values?.purpose ?? "") === value ? "page" : undefined
            }
          >
            {label}
          </Link>
        ))}
        <span className="search-intelligence">
          <Sparkles size={14} /> Busca inteligente ImobView
        </span>
      </div>
      <input type="hidden" name="purpose" value={values?.purpose ?? ""} />
      <div className="search-main">
        <Search size={23} />
        <label className="search-query">
          <span>Como é o lugar que você procura?</span>
          <input
            name="q"
            aria-label="Descreva o imóvel que procura"
            maxLength={300}
            defaultValue={values?.q}
            placeholder="Casa em Campinas, 3 quartos, 2 banheiros e 4 vagas..."
          />
        </label>
        <button className="button button-primary">
          Encontrar imóvel <Search size={17} />
        </button>
      </div>
      <details
        className="search-advanced"
        open={
          !!values &&
          !!(
            values.city ||
            values.neighborhood ||
            values.bedrooms ||
            values.bathrooms ||
            values.parkingSpaces ||
            values.maxPrice ||
            values.type
          )
        }
      >
        <summary>
          <SlidersHorizontal size={14} /> Refinar busca
        </summary>
        <div className="search-fields">
          <label className="field">
            Cidade
            <input
              name="city"
              defaultValue={values?.city}
              maxLength={120}
              placeholder="Ex.: Campinas"
            />
          </label>
          <label className="field">
            Bairro
            <input
              name="neighborhood"
              defaultValue={values?.neighborhood}
              maxLength={120}
              placeholder="Ex.: Cambuí"
            />
          </label>
          <label className="field">
            Tipo
            <select name="type" defaultValue={values?.type ?? ""}>
              <option value="">Todos os tipos</option>
              <option value="HOUSE">Casa</option>
              <option value="APARTMENT">Apartamento</option>
              <option value="LAND">Terreno</option>
              <option value="COMMERCIAL">Comercial</option>
            </select>
          </label>
          <label className="field">
            Quartos (mín.)
            <input
              type="number"
              name="bedrooms"
              min={0}
              max={50}
              defaultValue={values?.bedrooms || ""}
              placeholder="Qualquer"
            />
          </label>
          <label className="field">
            Banheiros (mín.)
            <input
              type="number"
              name="bathrooms"
              min={0}
              max={50}
              defaultValue={values?.bathrooms || ""}
              placeholder="Qualquer"
            />
          </label>
          <label className="field">
            Vagas (mín.)
            <input
              type="number"
              name="parkingSpaces"
              min={0}
              max={100}
              defaultValue={values?.parkingSpaces || ""}
              placeholder="Qualquer"
            />
          </label>
          <label className="field">
            Valor máximo (R$)
            <input
              type="number"
              name="maxPrice"
              min={0}
              max={1e12}
              step="0.01"
              defaultValue={values?.maxPrice || ""}
              placeholder="Sem limite"
            />
          </label>
          <label className="field">
            Ordenar
            <select name="sort" defaultValue={values?.sort ?? "recent"}>
              <option value="recent">Mais recentes</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </select>
          </label>
        </div>
      </details>
      <p className="search-help">
        Dica: escreva cidade, bairro, quantidade de quartos e “até 3 mil” para
        definir seu orçamento. Quartos, banheiros e vagas indicam quantidades
        mínimas.
      </p>
    </Form>
  );
}
