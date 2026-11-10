import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { databasePoolConfig } from "../src/config/database-pool.mjs";
import {
  tourDocumentSchema,
  publicationIssues,
} from "../src/features/tours/schema";
import { apartmentDoorways } from "./apartment-demo-layout";

const apply = process.argv.includes("--apply");
const names = [
  "living",
  "cozinha",
  "gourmet",
  "varanda",
  "suite",
  "quarto",
  "banheiro",
  "banheiro-suite",
];
const root = "public/demo/apartamento-aurora";
const pool = new Pool(
  databasePoolConfig(
    process.env.DIRECT_DATABASE_URL!,
    process.env.DATABASE_CA_CERT,
  ),
);
const client = await pool.connect();
const bucket = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
).storage.from(process.env.SUPABASE_TOUR_BUCKET || "imobview-tours");
const uploaded: string[] = [];
let committed = false;
try {
  await client.query("BEGIN");
  const {
    rows: [property],
  } = await client.query('SELECT * FROM "Property" WHERE slug=$1 FOR UPDATE', [
    "apartamento-jardim-demo",
  ]);
  if (!property?.isDemo || property.internalCode !== "DEMO-AURORA-360")
    throw new Error("O cadastro não é a demonstração Aurora.");
  await client.query("SELECT set_config('app.organization_id',$1,true)", [
    property.organizationId,
  ]);
  const {
    rows: [tour],
  } = await client.query(
    'SELECT * FROM "Tour" WHERE "propertyId"=$1 AND title=$2 FOR UPDATE',
    [property.id, "Apartamento Aurora · visita completa"],
  );
  if (!tour?.published) throw new Error("Tour de demonstração não encontrado.");
  const { rows: assets } = await client.query(
    'SELECT * FROM "PanoramaAsset" WHERE "tourId"=$1 ORDER BY "createdAt"',
    [tour.id],
  );
  const { rows: photos } = await client.query(
    'SELECT * FROM "PropertyPhoto" WHERE "propertyId"=$1 ORDER BY "createdAt"',
    [property.id],
  );
  const document = tourDocumentSchema.parse(tour.published);
  // Preserve a draft being edited by the user; only update an identical draft.
  const updateDraft =
    JSON.stringify(tour.draft) === JSON.stringify(tour.published);
  const ordered = names.map((name) => {
    const asset = assets.find((asset) => asset.fileName === `${name}.jpg`);
    const scene = document.scenes.find((scene) => scene.assetId === asset?.id);
    if (!scene) throw new Error(`Ambiente não encontrado: ${name}`);
    return scene;
  });
  for (let i = 0; i < ordered.length; i++) {
    ordered[i].hotspots = apartmentDoorways
      .filter((doorway) => doorway.from === i)
      .map((doorway) => ({
        id: randomUUID(),
        targetSceneId: ordered[doorway.to].id,
        yaw: doorway.yaw,
        pitch: doorway.pitch,
        label: `${doorway.via ? `${doorway.via} · ` : ""}${ordered[doorway.to].title}`,
      }));
  }
  if (publicationIssues(document).length)
    throw new Error("A navegação contém ambientes desconectados.");
  const files = [];
  for (const name of names)
    for (const kind of ["panoramas", "fotos"]) {
      const bytes = await readFile(`${root}/${kind}-v2/${name}.jpg`);
      const meta = await sharp(bytes).metadata();
      if (
        !meta.width ||
        !meta.height ||
        bytes.length > 20 * 1024 * 1024 ||
        (kind === "panoramas" &&
          (meta.width !== meta.height * 2 || meta.width < 1024))
      )
        throw new Error(`Imagem inválida: ${kind}/${name}`);
      const asset = (kind === "panoramas" ? assets : photos).find(
        (asset) => asset.fileName === `${name}.jpg`,
      );
      if (!asset) throw new Error(`Mídia ausente: ${name}`);
      const hash = createHash("sha256")
        .update(bytes)
        .digest("hex")
        .slice(0, 16);
      const key =
        kind === "panoramas"
          ? `${property.organizationId}/${tour.id}/${asset.id}-${hash}.jpg`
          : `${property.organizationId}/photos/${property.id}/${asset.id}-${hash}.jpg`;
      files.push({
        asset,
        key,
        bytes,
        kind,
        width: meta.width,
        height: meta.height,
      });
    }
  if (apply) {
    await mkdir(".local", { recursive: true });
    await writeFile(
      `.local/aurora-before-quality-${Date.now()}.json`,
      JSON.stringify(
        { property, tour, assets, photos },
        (_key, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      ),
    );
    for (const file of files) {
      if (file.asset.storageKey === file.key) continue;
      const { error } = await bucket.upload(file.key, file.bytes, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "300",
      });
      if (error) {
        const existing = await bucket.download(file.key);
        if (
          !existing.data ||
          !Buffer.from(await existing.data.arrayBuffer()).equals(file.bytes)
        )
          throw new Error(`Upload recusado: ${error.message}`);
      } else uploaded.push(file.key);
      if (file.kind === "panoramas")
        await client.query(
          'UPDATE "PanoramaAsset" SET "storageKey"=$2,size=$3,width=$4,height=$5,"updatedAt"=now() WHERE id=$1',
          [file.asset.id, file.key, file.bytes.length, file.width, file.height],
        );
      else
        await client.query(
          'UPDATE "PropertyPhoto" SET "storageKey"=$2,size=$3,"updatedAt"=now() WHERE id=$1',
          [file.asset.id, file.key, file.bytes.length],
        );
    }
    await client.query(
      'UPDATE "Tour" SET published=$2::jsonb,draft=CASE WHEN $3 THEN $2::jsonb ELSE draft END,version=version+1,"updatedAt"=now() WHERE id=$1',
      [tour.id, JSON.stringify(document), updateDraft],
    );
    await client.query(
      'UPDATE "Property" SET cover=$2,"captureLeads"=true,"updatedAt"=now() WHERE id=$1',
      [property.id, "/demo/apartamento-aurora/fotos-v2/living.jpg"],
    );
    await client.query("COMMIT");
    committed = true;
  } else await client.query("ROLLBACK");
  console.log(
    JSON.stringify({
      applied: apply,
      rooms: ordered.length,
      connections: apartmentDoorways.length,
      updatedImages: files.length,
      preservedDraft: !updateDraft,
      originalObjectsPreserved: true,
    }),
  );
} catch (error) {
  await client.query("ROLLBACK");
  if (!committed && uploaded.length) {
    const cleanup = await bucket.remove(uploaded);
    if (cleanup.error) console.error("Objetos pendentes de limpeza:", uploaded);
  }
  throw error;
} finally {
  client.release();
  await pool.end();
}
