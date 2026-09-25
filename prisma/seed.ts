import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production")
  throw new Error("Demo seed is forbidden in production.");
const url = process.env.DIRECT_DATABASE_URL;
const password = process.env.SEED_PASSWORD;
if (!url || !password || password.length < 12)
  throw new Error(
    "Set DIRECT_DATABASE_URL and SEED_PASSWORD (12+ characters).",
  );
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("Demo seed only supports a local database.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});
const organizations = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "imobiliaria-demo",
    name: "Imobiliária Demo",
    email: "admin@imobview.test",
    userName: "Admin Demo",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "outra-imobiliaria",
    name: "Outra Imobiliária",
    email: "outro@imobview.test",
    userName: "Outro Admin",
  },
];
try {
  for (const org of organizations) {
    const organization = await db.organization.upsert({
      where: { slug: org.slug },
      update: {},
      create: { id: org.id, slug: org.slug, name: org.name },
    });
    const user = await db.user.upsert({
      where: { email: org.email },
      update: {},
      create: {
        id: randomUUID(),
        email: org.email,
        name: org.userName,
        emailVerified: true,
      },
    });
    await db.account.upsert({
      where: {
        providerId_accountId: { providerId: "credential", accountId: user.id },
      },
      update: {},
      create: {
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await hashPassword(password),
      },
    });
    await db.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: "OWNER",
      },
    });
    const examples =
      org.slug === "imobiliaria-demo"
        ? [
            {
              title: "Casa Horizonte",
              slug: "casa-horizonte-demo",
              cover: "/images/residencia.jpg",
              status: "PUBLISHED" as const,
              type: "HOUSE" as const,
              priceCents: 245000000,
              area: 320,
              bedrooms: 4,
            },
            {
              title: "Apartamento Jardim",
              slug: "apartamento-jardim-demo",
              cover: "/images/living.jpg",
              status: "DRAFT" as const,
              type: "APARTMENT" as const,
              priceCents: 98000000,
              area: 145,
              bedrooms: 3,
            },
            {
              title: "Refúgio contemporâneo",
              slug: "refugio-contemporaneo-demo",
              cover: "/images/interior.jpg",
              status: "DRAFT" as const,
              type: "APARTMENT" as const,
              priceCents: 165000000,
              area: 210,
              bedrooms: 3,
            },
          ]
        : [
            {
              title: "Imóvel privado da Organização B",
              slug: "imovel-privado-b",
              cover: null,
              status: "DRAFT" as const,
              type: "HOUSE" as const,
              priceCents: 50000000,
              area: 100,
              bedrooms: 2,
            },
          ];
    for (const item of examples)
      await db.property.upsert({
        where: { slug: item.slug },
        update: {},
        create: {
          ...item,
          organizationId: organization.id,
          description:
            "Imóvel fictício para demonstração. Ambientes integrados, iluminação natural e espaços pensados para viver bem. Não se trata de uma oferta comercial.",
          city: "São Paulo",
          state: "SP",
          neighborhood: "Jardins",
          bathrooms: 3,
          parkingSpaces: 2,
          publishedAt: item.status === "PUBLISHED" ? new Date() : null,
        },
      });
  }
  process.stdout.write(
    "Seed concluído: duas organizações e quatro imóveis fictícios. Use a senha definida em SEED_PASSWORD.\n",
  );
} finally {
  await db.$disconnect();
}
