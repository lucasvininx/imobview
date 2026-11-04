import { z } from "zod";

export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const numberWords: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};
export const searchSchema = z.object({
  q: z.string().trim().max(300).default(""),
  purpose: z.enum(["", "SALE", "RENT"]).default(""),
  type: z.enum(["", "HOUSE", "APARTMENT", "LAND", "COMMERCIAL"]).default(""),
  city: z.string().trim().max(120).default(""),
  neighborhood: z.string().trim().max(120).default(""),
  bedrooms: z.coerce.number().int().min(0).max(50).default(0),
  bathrooms: z.coerce.number().int().min(0).max(50).default(0),
  parkingSpaces: z.coerce.number().int().min(0).max(100).default(0),
  maxPrice: z.coerce.number().min(0).max(1e12).default(0),
  sort: z.enum(["recent", "price-asc", "price-desc"]).default("recent"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type SearchInput = z.infer<typeof searchSchema>;

/** Local language interpretation: no model or external service receives visitor searches. */
export function interpretSearch(input: SearchInput) {
  let text = normalizeSearch(input.q);
  const filters = { ...input, suites: 0, tokens: [] as string[] };
  const amount =
    "(\\d{1,2}|zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)";
  const attributes = [
    ["bedrooms", "quartos?|dormitorios?"],
    ["bathrooms", "banheiros?"],
    ["parkingSpaces", "vagas?(?:\\s+(?:na|de)\\s+garagem)?"],
    ["suites", "suites?"],
  ] as const;
  for (const [key, words] of attributes) {
    text = text.replace(
      new RegExp(`\\b${amount}\\s*\\+?\\s*(?:${words})\\b`, "g"),
      (_, raw: string) => {
        if (!filters[key]) filters[key] = numberWords[raw] ?? Number(raw);
        return " ";
      },
    );
  }
  text = text.replace(
    /\b(?:ate|no maximo|por menos de)\s*(?:r\$\s*)?(\d[\d.,]*)\s*(milhoes|milhao|mil|k)?\b/g,
    (_, raw: string, unit: string) => {
      const amount = Number(
        raw.includes(",")
          ? raw.replace(/\./g, "").replace(",", ".")
          : raw.replace(/\.(?=\d{3}(?:\D|$))/g, ""),
      );
      if (!Number.isFinite(amount) || amount <= 0) return raw;
      if (!filters.maxPrice)
        filters.maxPrice =
          amount *
          (unit === "mil" || unit === "k"
            ? 1000
            : unit?.startsWith("milh")
              ? 1e6
              : 1);
      return " ";
    },
  );
  text = text.replace(
    /\b(alugar|aluguel|locacao|comprar|compra|venda)\b/g,
    (word) => {
      if (!filters.purpose)
        filters.purpose = /^(alugar|aluguel|locacao)$/.test(word)
          ? "RENT"
          : "SALE";
      return " ";
    },
  );
  text = text.replace(
    /\b(casas?|apartamentos?|aptos?|terrenos?|comercial|comerciais)\b/g,
    (word) => {
      if (!filters.type)
        filters.type = word.startsWith("casa")
          ? "HOUSE"
          : /^(apart|apto)/.test(word)
            ? "APARTMENT"
            : word.startsWith("terreno")
              ? "LAND"
              : "COMMERCIAL";
      return " ";
    },
  );
  text = text.replace(
    /\b(?:no bairro|na regiao de|bairro)\s+([a-z][a-z\s-]*?)(?=\s+(?:com|ate|para|em|na cidade)\b|[,.;]|$)/g,
    (_, location: string) => {
      if (!filters.neighborhood) filters.neighborhood = location.trim();
      return " ";
    },
  );
  text = text.replace(
    /\b(?:na cidade de|em)\s+([a-z][a-z\s-]*?)(?=\s+(?:com|ate|para|no|na)\b|[,.;]|$)/g,
    (_, location: string) => {
      if (!filters.city) filters.city = location.trim();
      return " ";
    },
  );
  const stop = new Set(
    "quero procuro buscando busco encontrar imovel imoveis para pra de do da dos das a o as os e em no na nos nas com ao uma um que tenha tenham pelo pela bairro cidade reais r garagem pelo menos partir mais me mostre mostrar preciso gostaria".split(
      " ",
    ),
  );
  filters.tokens = [
    ...new Set(
      text
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word && !stop.has(word)),
    ),
  ].slice(0, 30);
  return filters;
}
