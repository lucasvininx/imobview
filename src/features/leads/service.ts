import "server-only";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";
import { DomainError } from "@/domain/errors";
import { stageSchema } from "./schema";
const idSchema = z.uuid();
export function commercialOverview(actor: Actor) {
  const since = new Date(Date.now() - 30 * 86400000);
  return withTenant(actor, "lead:read", async (tx) => ({
    leads: await tx.lead.count({
      where: {
        organizationId: actor.organizationId,
        createdAt: { gte: since },
      },
    }),
    requests: await tx.visitRequest.count({
      where: { organizationId: actor.organizationId, status: "REQUESTED" },
    }),
  }));
}
export function listLeads(actor: Actor, propertyId?: string, stage?: string) {
  if (propertyId) idSchema.parse(propertyId);
  if (stage) stageSchema.parse(stage);
  return withTenant(actor, "lead:read", (tx) =>
    tx.lead.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(propertyId ? { propertyId } : {}),
        ...(stage ? { stage } : {}),
      },
      include: {
        property: { select: { title: true } },
        _count: { select: { requests: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
}
export function getLead(actor: Actor, id: string) {
  idSchema.parse(id);
  return withTenant(actor, "lead:read", async (tx) => {
    const lead = await tx.lead.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        property: {
          select: { title: true, broker: { select: { name: true } } },
        },
        requests: { orderBy: { createdAt: "desc" } },
        visits: {
          select: {
            id: true,
            createdAt: true,
            startedAt: true,
            endedAt: true,
            completedAt: true,
            lastSeenAt: true,
            tracking: true,
            scenes: true,
            events: { orderBy: { sequence: "asc" } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!lead) throw new DomainError("NOT_FOUND", "Lead não encontrado.");
    return lead;
  });
}
export function updateLead(actor: Actor, id: string, input: unknown) {
  idSchema.parse(id);
  const data = z
    .object({ stage: stageSchema, notes: z.string().trim().max(5000) })
    .parse(input);
  return withTenant(actor, "lead:update", async (tx) => {
    const existing = await tx.lead.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!existing) throw new DomainError("NOT_FOUND", "Lead não encontrado.");
    return tx.lead.update({
      where: {
        id_organizationId: { id, organizationId: actor.organizationId },
      },
      data: {
        ...data,
        ...(data.stage === "PROPOSAL" && !existing.proposalAt
          ? { proposalAt: new Date() }
          : {}),
        ...(data.stage === "WON" && !existing.wonAt
          ? { wonAt: new Date() }
          : {}),
      },
    });
  });
}
export function deleteLead(actor: Actor, id: string) {
  idSchema.parse(id);
  return withTenant(actor, "organization:manage", (tx) =>
    tx.lead.deleteMany({ where: { id, organizationId: actor.organizationId } }),
  );
}
export function listRequests(actor: Actor) {
  return withTenant(actor, "lead:read", (tx) =>
    tx.visitRequest.findMany({
      where: { organizationId: actor.organizationId },
      include: {
        lead: { select: { name: true, property: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
}
export function updateRequest(actor: Actor, id: string, input: unknown) {
  idSchema.parse(id);
  const status = z.enum(["REQUESTED", "CONFIRMED", "CANCELLED"]).parse(input);
  return withTenant(actor, "lead:update", async (tx) => {
    const result = await tx.visitRequest.updateMany({
      where: { id, organizationId: actor.organizationId },
      data: { status },
    });
    if (!result.count)
      throw new DomainError("NOT_FOUND", "Solicitação não encontrada.");
  });
}
export function analytics(actor: Actor, propertyId?: string) {
  if (propertyId) idSchema.parse(propertyId);
  const since = new Date(Date.now() - 30 * 86400000);
  return withTenant(actor, "lead:read", async (tx) => {
    const where = {
      organizationId: actor.organizationId,
      ...(propertyId ? { propertyId } : {}),
      createdAt: { gte: since },
    };
    const [
      sessions,
      leads,
      requests,
      proposals,
      sales,
      started,
      completed,
      rooms,
      sources,
    ] = await Promise.all([
      tx.tourVisit.count({ where: { ...where, tracking: true } }),
      tx.lead.count({ where }),
      tx.visitRequest.count({
        where: {
          organizationId: actor.organizationId,
          createdAt: { gte: since },
          ...(propertyId ? { lead: { propertyId } } : {}),
        },
      }),
      tx.lead.count({ where: { ...where, proposalAt: { not: null } } }),
      tx.lead.count({ where: { ...where, wonAt: { not: null } } }),
      tx.tourVisit.count({
        where: { ...where, tracking: true, startedAt: { not: null } },
      }),
      tx.tourVisit.count({
        where: { ...where, tracking: true, completedAt: { not: null } },
      }),
      tx.$queryRaw<
        {
          id: string;
          title: string;
          property: string;
          views: bigint;
          duration: bigint;
        }[]
      >`
        SELECT v."propertyId"::text || e."sceneId"::text AS id,
          max(s->>'title') AS title, max(p.title) AS property,
          count(*) FILTER (WHERE e.kind='SCENE') AS views, sum(e."durationMs") AS duration
        FROM "TourVisit" v JOIN "JourneyEvent" e ON e."visitId"=v.id AND e."organizationId"=v."organizationId"
        JOIN "Property" p ON p.id=v."propertyId" AND p."organizationId"=v."organizationId"
        JOIN LATERAL jsonb_array_elements(v.scenes) s ON s->>'id'=e."sceneId"::text
        WHERE v."organizationId"=${actor.organizationId}::uuid AND v.tracking=true AND v."createdAt">=${since}
          AND (${propertyId ?? null}::uuid IS NULL OR v."propertyId"=${propertyId ?? null}::uuid)
        GROUP BY v."propertyId",e."sceneId" ORDER BY duration DESC LIMIT 3000`,
      tx.$queryRaw<
        { source: string; count: bigint }[]
      >`SELECT source,count(*) AS count FROM "TourVisit"
        WHERE "organizationId"=${actor.organizationId}::uuid AND tracking=true AND "createdAt">=${since}
          AND (${propertyId ?? null}::uuid IS NULL OR "propertyId"=${propertyId ?? null}::uuid)
        GROUP BY source ORDER BY count DESC LIMIT 100`,
    ]);
    return {
      sessions,
      leads,
      requests,
      proposals,
      sales,
      started,
      completed,
      rooms: rooms.map((r) => ({
        ...r,
        views: Number(r.views),
        duration: Number(r.duration),
      })),
      sources: sources.map((s) => ({ ...s, count: Number(s.count) })),
    };
  });
}
