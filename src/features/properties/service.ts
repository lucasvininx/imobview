import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";
import { propertySchema } from "./schema";
import { toCents } from "@/lib/format";
import { DomainError } from "@/domain/errors";

export function getPropertyStats(actor: Actor) {
  return withTenant(actor, "property:read", async (tx) => {
    const groups = await tx.property.groupBy({
      by: ["status"],
      where: { organizationId: actor.organizationId },
      _count: true,
    });
    return {
      active: groups
        .filter((group) => group.status !== "ARCHIVED")
        .reduce((total, group) => total + group._count, 0),
      published:
        groups.find((group) => group.status === "PUBLISHED")?._count ?? 0,
      drafts: groups.find((group) => group.status === "DRAFT")?._count ?? 0,
    };
  });
}

export function listProperties(actor: Actor, search = "") {
  const query = z.string().max(160).parse(search);
  return withTenant(actor, "property:read", (tx) =>
    tx.property.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query
          ? { title: { contains: query, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  );
}
export function getProperty(actor: Actor, id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new DomainError("NOT_FOUND", "Imóvel não encontrado.");
  return withTenant(actor, "property:read", async (tx) => {
    const property = await tx.property.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!property) throw new DomainError("NOT_FOUND", "Imóvel não encontrado.");
    return property;
  });
}
export function saveProperty(actor: Actor, input: unknown, id?: string) {
  const { price, ...data } = propertySchema.parse(input);
  if (id && !z.uuid().safeParse(id).success)
    throw new DomainError("NOT_FOUND", "Imóvel não encontrado.");
  return withTenant(
    actor,
    id ? "property:update" : "property:create",
    async (tx) => {
      if (id) {
        const existing = await tx.property.findFirst({
          where: { id, organizationId: actor.organizationId },
        });
        if (!existing)
          throw new DomainError("NOT_FOUND", "Imóvel não encontrado.");
        if (existing.status === "ARCHIVED")
          throw new DomainError(
            "CONFLICT",
            "Imóveis arquivados não podem ser editados.",
          );
        return tx.property.update({
          where: {
            id_organizationId: { id, organizationId: actor.organizationId },
          },
          data: { ...data, priceCents: toCents(price) },
        });
      }
      const newId = randomUUID();
      const slug = `${data.title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${newId}`;
      return tx.property.create({
        data: {
          ...data,
          id: newId,
          slug,
          organizationId: actor.organizationId,
          priceCents: toCents(price),
        },
      });
    },
  );
}
export function changePropertyStatus(actor: Actor, id: string, input: unknown) {
  const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).parse(input);
  if (!z.uuid().safeParse(id).success)
    throw new DomainError("NOT_FOUND", "Imóvel não encontrado.");
  return withTenant(
    actor,
    status === "ARCHIVED" ? "property:archive" : "property:publish",
    async (tx) => {
      const property = await tx.property.findFirst({
        where: { id, organizationId: actor.organizationId },
      });
      if (!property)
        throw new DomainError("NOT_FOUND", "Imóvel não encontrado.");
      if (
        status === "PUBLISHED" &&
        (!property.description ||
          !property.city ||
          property.area <= 0 ||
          property.priceCents <= BigInt(0))
      )
        throw new DomainError(
          "VALIDATION",
          "Preencha descrição, cidade, área e preço antes de publicar.",
        );
      if (property.status === "ARCHIVED")
        throw new DomainError("CONFLICT", "Este imóvel já está arquivado.");
      return tx.property.update({
        where: {
          id_organizationId: { id, organizationId: actor.organizationId },
        },
        data: {
          status,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
          archivedAt: status === "ARCHIVED" ? new Date() : null,
        },
      });
    },
  );
}
