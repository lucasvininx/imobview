import "dotenv/config";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { databasePoolConfig } from "../src/config/database-pool.mjs";
import { apartmentDoorways } from "./apartment-demo-layout";
import {
  publicationIssues,
  tourDocumentSchema,
} from "../src/features/tours/schema";

// Explicit, repeatable fixture. Only this marked demonstration can be updated.
const apply = process.argv.includes("--apply");
const slug = "apartamento-jardim-demo";
const code = "DEMO-AURORA-360";
const root = "public/demo/apartamento-aurora";
const rooms = [
  [
    "living",
    "Sala de estar e jantar",
    "Ambientes integrados",
    "Sala de estar e jantar com iluminação natural e espaço para receber.",
    0.38,
    0.5,
  ],
  [
    "cozinha",
    "Cozinha",
    "Cozinha planejada",
    "Marcenaria em carvalho, bancada clara e ilha para as refeições do dia a dia.",
    0.18,
    0.5,
  ],
  [
    "gourmet",
    "Área gourmet",
    "Espaço para receber",
    "Bancada de apoio, churrasqueira elétrica e integração com a varanda.",
    0.2,
    0.16,
  ],
  [
    "varanda",
    "Varanda",
    "Vista aberta",
    "Varanda com área de estar, vegetação e vista para o bairro.",
    0.48,
    0.16,
  ],
  [
    "suite",
    "Suíte principal",
    "Descanso e privacidade",
    "Suíte com cama king, armários planejados e banheiro privativo.",
    0.8,
    0.23,
  ],
  [
    "quarto",
    "Quarto de hóspedes",
    "Quarto versátil",
    "Segundo dormitório com bancada de trabalho e armários.",
    0.8,
    0.79,
  ],
  [
    "banheiro",
    "Banheiro social",
    "Acabamentos",
    "Bancada com marcenaria, metais pretos e box de vidro.",
    0.54,
    0.81,
  ],
  [
    "banheiro-suite",
    "Banheiro da suíte",
    "Bancada dupla",
    "Banheiro privativo com duas cubas e box de vidro.",
    0.8,
    0.5,
  ],
] as const;
// Bidirectional graph: no room is a dead end.
const pool = new Pool(
  databasePoolConfig(
    process.env.DIRECT_DATABASE_URL!,
    process.env.DATABASE_CA_CERT,
  ),
);
const client = await pool.connect();
const uploaded: string[] = [];
let committed = false;
const bucket = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
).storage.from(process.env.SUPABASE_TOUR_BUCKET || "imobview-tours");
try {
  await client.query("BEGIN");
  const {
    rows: [org],
  } = await client.query(
    'SELECT id,"maxProperties","maxStorageBytes","maxPanoramas" FROM "Organization" WHERE slug=$1 FOR UPDATE',
    ["imobiliaria-demo"],
  );
  if (!org) throw new Error("Organização demonstrativa não encontrada.");
  await client.query("SELECT set_config('app.organization_id',$1,true)", [
    org.id,
  ]);
  const {
    rows: [existing],
  } = await client.query('SELECT * FROM "Property" WHERE slug=$1', [slug]);
  if (
    existing &&
    (!existing.isDemo ||
      ![code, ""].includes(existing.internalCode) ||
      existing.organizationId !== org.id)
  )
    throw new Error("O slug está em uso por outro cadastro.");
  const {
    rows: [usage],
  } = await client.query(
    'SELECT count(*)::int AS total FROM "Property" WHERE "organizationId"=$1 AND status<>\'ARCHIVED\'',
    [org.id],
  );
  if (!existing && usage.total >= org.maxProperties)
    throw new Error("Limite de imóveis atingido.");
  if (existing?.internalCode === code) {
    const {
      rows: [published],
    } = await client.query(
      'SELECT id,published FROM "Tour" WHERE "propertyId"=$1 AND title=$2',
      [existing.id, "Apartamento Aurora · visita completa"],
    );
    if (
      published?.published &&
      publicationIssues(tourDocumentSchema.parse(published.published))
        .length === 0
    ) {
      console.log(
        JSON.stringify({
          alreadyPrepared: true,
          slug,
          propertyId: existing.id,
          tourId: published.id,
        }),
      );
      await client.query("ROLLBACK");
      process.exitCode = 0;
    } else
      throw new Error(
        "Demonstração existente incompleta; revise antes de alterar.",
      );
  } else {
    if (existing) {
      const {
        rows: [media],
      } = await client.query(
        'SELECT (SELECT count(*) FROM "Tour" WHERE "propertyId"=$1) + (SELECT count(*) FROM "PropertyPhoto" WHERE "propertyId"=$1) AS total',
        [existing.id],
      );
      if (Number(media.total) !== 0)
        throw new Error(
          "O cadastro demonstrativo já possui mídia. Revise antes de alterar.",
        );
    }
    const propertyId = existing?.id ?? randomUUID(),
      tourId = randomUUID(),
      planId = randomUUID(),
      planAssetId = randomUUID();
    const sceneIds = rooms.map(() => randomUUID()),
      assetIds = rooms.map(() => randomUUID());
    const files: {
      id: string;
      key: string;
      bytes: Buffer;
      width: number;
      height: number;
      kind: string;
      name: string;
    }[] = [];
    for (let i = 0; i < rooms.length; i++) {
      const name = `${rooms[i][0]}.jpg`;
      const bytes = await readFile(`${root}/panoramas/${name}`);
      const meta = await sharp(bytes).metadata();
      if (
        !meta.width ||
        !meta.height ||
        meta.width !== meta.height * 2 ||
        meta.width < 1024
      )
        throw new Error(`Panorama inválido: ${name}`);
      files.push({
        id: assetIds[i],
        key: `${org.id}/${tourId}/${assetIds[i]}.jpg`,
        bytes,
        width: meta.width,
        height: meta.height,
        kind: "PANORAMA",
        name,
      });
    }
    const plan = await readFile(`${root}/planta.webp`);
    const meta = await sharp(plan).metadata();
    files.push({
      id: planAssetId,
      key: `${org.id}/${tourId}/${planAssetId}.webp`,
      bytes: plan,
      width: meta.width!,
      height: meta.height!,
      kind: "FLOOR_PLAN",
      name: "planta.webp",
    });
    const photos = await Promise.all(
      rooms.map(async (room) => ({
        id: randomUUID(),
        name: `${room[0]}.jpg`,
        bytes: await readFile(`${root}/fotos/${room[0]}.jpg`),
      })),
    );
    const {
      rows: [storageUsage],
    } = await client.query(
      'SELECT (SELECT COALESCE(sum(size),0) FROM "PanoramaAsset" WHERE "organizationId"=$1 AND status<>\'FAILED\') + (SELECT COALESCE(sum(size),0) FROM "PropertyPhoto" WHERE "organizationId"=$1 AND status<>\'FAILED\') AS bytes, (SELECT count(*) FROM "PanoramaAsset" WHERE "organizationId"=$1 AND status<>\'FAILED\') AS panoramas',
      [org.id],
    );
    if (
      Number(storageUsage.bytes) +
        files.reduce((s, f) => s + f.bytes.length, 0) +
        photos.reduce((s, f) => s + f.bytes.length, 0) >
        Number(org.maxStorageBytes) ||
      Number(storageUsage.panoramas) + files.length > org.maxPanoramas
    )
      throw new Error("Limite de mídia atingido.");
    const document = tourDocumentSchema.parse({
      initialSceneId: sceneIds[0],
      floorPlans: [
        {
          id: planId,
          assetId: planAssetId,
          title: "Apartamento · planta ilustrativa",
        },
      ],
      scenes: rooms.map((room, i) => ({
        id: sceneIds[i],
        assetId: assetIds[i],
        title: room[1],
        initialYaw: 0,
        initialPitch: 0,
        planPosition: { planId, x: room[4], y: room[5] },
        infoPoints: [
          {
            id: randomUUID(),
            yaw: 0.65,
            pitch: 0.05,
            title: room[2],
            text: room[3],
          },
        ],
        hotspots: apartmentDoorways
          .filter((doorway) => doorway.from === i)
          .map((doorway) => {
            const target = doorway.to;
            return {
              id: randomUUID(),
              targetSceneId: sceneIds[target],
              label: `${doorway.via ? `${doorway.via} · ` : ""}${rooms[target][1]}`,
              yaw: doorway.yaw,
              pitch: doorway.pitch,
            };
          }),
      })),
    });
    if (publicationIssues(document).length)
      throw new Error("Existem ambientes desconectados.");
    if (apply) {
      await client.query(
        `INSERT INTO "Property" (id,"organizationId",title,slug,description,type,purpose,city,state,neighborhood,"priceCents",area,bedrooms,bathrooms,"parkingSpaces",suites,cover,"internalCode",condominium,"commercialNotes","isDemo",status,"captureLeads","publishedAt","updatedAt") VALUES($1,$2,$3,$4,$5,'APARTMENT','SALE','Campinas','SP','Cambuí',128000000,128,2,2,2,1,$6,$7,'Residencial Aurora — demonstrativo',$8,true,'PUBLISHED',false,now(),now()) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,type=EXCLUDED.type,purpose=EXCLUDED.purpose,city=EXCLUDED.city,state=EXCLUDED.state,neighborhood=EXCLUDED.neighborhood,"priceCents"=EXCLUDED."priceCents",area=EXCLUDED.area,bedrooms=EXCLUDED.bedrooms,bathrooms=EXCLUDED.bathrooms,"parkingSpaces"=EXCLUDED."parkingSpaces",suites=EXCLUDED.suites,cover=EXCLUDED.cover,"internalCode"=EXCLUDED."internalCode",condominium=EXCLUDED.condominium,"commercialNotes"=EXCLUDED."commercialNotes",status=EXCLUDED.status,"captureLeads"=EXCLUDED."captureLeads","publishedAt"=EXCLUDED."publishedAt","updatedAt"=now()`,
        [
          propertyId,
          org.id,
          "Apartamento Aurora · varanda e espaço gourmet",
          slug,
          "Um apartamento pensado para viver bem e receber com conforto. São 128 m² com sala de estar e jantar integradas, cozinha com ilha, área gourmet e varanda com vista aberta.\n\nNa área íntima, uma suíte principal com banheiro de bancada dupla e um segundo quarto com espaço para home office. O banheiro social atende às visitas com privacidade. Duas vagas de garagem completam a apresentação.\n\nCarvalho natural, tons claros e detalhes em verde conectam todos os ambientes. Explore os oito pontos do tour 360° e navegue também pela planta ilustrativa.\n\nImóvel fictício de demonstração. Imagens geradas por IA e valores ilustrativos; não representa uma oferta comercial nem um levantamento arquitetônico.",
          "/demo/apartamento-aurora/fotos/living.jpg",
          code,
          "Material para demonstração em reuniões. Cadastro fictício, imagens de IA e planta esquemática. Sem oferta comercial.",
        ],
      );
      await client.query(
        'INSERT INTO "Tour" (id,"organizationId","propertyId",title,status,draft,published,"publishedAt","updatedAt") VALUES($1,$2,$3,$4,\'PUBLISHED\',$5::jsonb,$5::jsonb,now(),now())',
        [
          tourId,
          org.id,
          propertyId,
          "Apartamento Aurora · visita completa",
          JSON.stringify(document),
        ],
      );
      for (const file of files) {
        const { error } = await bucket.upload(file.key, file.bytes, {
          contentType: file.kind === "FLOOR_PLAN" ? "image/webp" : "image/jpeg",
          upsert: false,
          cacheControl: "300",
        });
        if (error)
          throw new Error(`Falha no upload ${file.name}: ${error.message}`);
        uploaded.push(file.key);
        await client.query(
          'INSERT INTO "PanoramaAsset" (id,"organizationId","tourId","storageKey","uploadKey",kind,"fileName","mimeType",size,width,height,status,"updatedAt") VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,\'READY\',now())',
          [
            file.id,
            org.id,
            tourId,
            file.key,
            file.kind,
            file.name,
            file.kind === "FLOOR_PLAN" ? "image/webp" : "image/jpeg",
            file.bytes.length,
            file.width,
            file.height,
          ],
        );
      }
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i],
          key = `${org.id}/photos/${propertyId}/${file.id}.jpg`;
        const { error } = await bucket.upload(key, file.bytes, {
          contentType: "image/jpeg",
          upsert: false,
          cacheControl: "300",
        });
        if (error) throw new Error(`Falha na foto ${file.name}`);
        uploaded.push(key);
        await client.query(
          'INSERT INTO "PropertyPhoto" (id,"organizationId","propertyId","storageKey","uploadKey","fileName",size,status,"createdAt","updatedAt") VALUES($1,$2,$3,$4,$4,$5,$6,\'READY\',now()+($7*interval \'1 second\'),now())',
          [file.id, org.id, propertyId, key, file.name, file.bytes.length, i],
        );
      }
      await client.query("COMMIT");
      committed = true;
    } else await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        applied: apply,
        slug,
        propertyId,
        tourId,
        rooms: rooms.length,
        photos: photos.length,
        connections: apartmentDoorways.length,
        floorPlan: true,
      }),
    );
  }
} catch (error) {
  await client.query("ROLLBACK");
  if (!committed && uploaded.length) {
    const { error: cleanupError } = await bucket.remove(uploaded);
    if (cleanupError) console.error("Revise objetos pendentes:", uploaded);
  }
  throw error;
} finally {
  client.release();
  await pool.end();
}
