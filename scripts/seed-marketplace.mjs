import "dotenv/config";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { databasePoolConfig } from "../src/config/database-pool.mjs";

// Explicit administrative fixture command: no authentication accounts or real listings are changed.
const apply = process.argv.includes("--apply");
const pool = new Pool(
  databasePoolConfig(
    process.env.DIRECT_DATABASE_URL,
    process.env.DATABASE_CA_CERT,
  ),
);
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const {
    rows: [organization],
  } = await client.query(
    'SELECT id,"maxProperties" FROM "Organization" WHERE slug=$1 FOR UPDATE',
    ["imobiliaria-demo"],
  );
  if (!organization)
    throw new Error("A organização de demonstração não foi encontrada.");
  const slugs = Array.from(
    { length: 20 },
    (_, i) => `catalogo-imobview-demo-${String(i + 1).padStart(2, "0")}`,
  );
  const existing = await client.query(
    'SELECT slug,"isDemo","internalCode" FROM "Property" WHERE slug=ANY($1::text[])',
    [slugs],
  );
  if (
    existing.rows.some(
      (row) => !row.isDemo || !row.internalCode.startsWith("DEMO-CATALOGO-"),
    )
  )
    throw new Error(
      "Há um cadastro fora do conjunto demonstrativo usando um dos slugs. Nenhum dado foi alterado.",
    );
  const {
    rows: [usage],
  } = await client.query(
    'SELECT count(*)::int AS active FROM "Property" WHERE "organizationId"=$1 AND status<>\'ARCHIVED\'',
    [organization.id],
  );
  const additions = 20 - existing.rowCount;
  if (usage.active + additions > organization.maxProperties)
    throw new Error(
      "O conjunto excede o limite de imóveis. Ajuste o limite da organização demonstrativa antes de executar.",
    );
  for (let i = 0; i < 20; i++) {
    const city =
      i % 4 < 2 ? "Campinas" : i % 4 === 2 ? "Valinhos" : "São Paulo";
    const neighborhood =
      city === "Campinas"
        ? ["Cambuí", "Taquaral", "Barão Geraldo", "Mansões Santo Antônio"][
            Math.floor(i / 4) % 4
          ]
        : city === "Valinhos"
          ? "Jardim Paiquerê"
          : "Vila Mariana";
    const type = i < 2 || i % 3 !== 0 ? "HOUSE" : "APARTMENT";
    const purpose = i % 2 === 0 ? "SALE" : "RENT";
    const bedrooms = i < 2 ? 3 : 2 + (Math.floor(i / 2) % 3);
    const bathrooms = i < 2 ? 2 : 1 + (Math.floor(i / 3) % 3);
    const parking = i < 2 ? 4 : 1 + (i % 3);
    const price =
      purpose === "SALE" ? 58000000 + i * 2350000 : 230000 + i * 13500;
    const title = `${type === "HOUSE" ? "Casa com jardim" : "Apartamento iluminado"} no ${neighborhood}`;
    const description = `Imóvel fictício para demonstração do ImobView. Não representa uma oferta comercial. ${type === "HOUSE" ? "Casa com jardim, sala integrada e quintal" : "Apartamento com varanda e sala integrada"} em ${neighborhood}, ${city}. ${bedrooms} quartos, ${bathrooms} banheiros e ${parking} vagas. Imagens e valores ilustrativos.`;
    const cover =
      type === "HOUSE"
        ? "/images/residencia.jpg"
        : i % 2
          ? "/images/living.jpg"
          : "/images/interior.jpg";
    if (apply)
      await client.query(
        `INSERT INTO "Property"(id,"organizationId",title,slug,description,type,purpose,city,state,neighborhood,"priceCents",area,bedrooms,bathrooms,"parkingSpaces",cover,"internalCode","isDemo",status,"captureLeads","publishedAt","updatedAt")
      VALUES($1,$2,$3,$4,$5,$6::"PropertyType",$7::"Purpose",$8,'SP',$9,$10,$11,$12,$13,$14,$15,$16,true,'PUBLISHED',false,now(),now()) ON CONFLICT(slug) DO NOTHING`,
        [
          randomUUID(),
          organization.id,
          title,
          slugs[i],
          description,
          type,
          purpose,
          city,
          neighborhood,
          price,
          type === "HOUSE" ? 140 + i * 8 : 65 + i * 3,
          bedrooms,
          bathrooms,
          parking,
          cover,
          `DEMO-CATALOGO-${String(i + 1).padStart(2, "0")}`,
        ],
      );
  }
  await client.query(apply ? "COMMIT" : "ROLLBACK");
  console.log(
    JSON.stringify({
      applied: apply,
      added: apply ? additions : 0,
      planned: additions,
      totalExamples: 20,
      sale: 10,
      rent: 10,
      cities: ["Campinas", "Valinhos", "São Paulo"],
    }),
  );
} catch (error) {
  await client.query("ROLLBACK");
  console.error(
    error instanceof Error ? error.message : "Falha ao preparar os exemplos.",
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
