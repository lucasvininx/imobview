import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { withTenant, type Actor } from "@/server/tenant";
import { DomainError } from "@/domain/errors";
import { exteriorSchema } from "./schema";

export async function saveExterior(actor: Actor, id: string, input: unknown) {
  z.uuid().parse(id);
  const exterior = exteriorSchema.parse(input);
  return withTenant(actor, "property:update", async (tx) => {
    const property = await tx.property.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!property || property.status === "ARCHIVED")
      throw new DomainError("NOT_FOUND", "Imóvel indisponível.");
    await tx.property.update({
      where: {
        id_organizationId: { id, organizationId: actor.organizationId },
      },
      data: { exterior },
    });
    return property.slug;
  });
}

// Public pages read the published, rounded projection only.
export async function publicExterior(slug: string) {
  if (!/^[a-z0-9-]{1,220}$/.test(slug)) return null;
  const [row] = await db.$queryRaw<
    { view: unknown }[]
  >`SELECT public.get_exterior_view(${slug}) AS view`;
  const parsed = exteriorSchema.safeParse(row?.view);
  return parsed.success ? parsed.data : null;
}
