import "server-only";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";
import { commercialSchema } from "./commercial-schema";
import { DomainError } from "@/domain/errors";
export async function saveCommercial(actor: Actor, id: string, input: unknown) {
  z.uuid().parse(id);
  const data = commercialSchema.parse(input);
  await withTenant(actor, "property:update", async (tx) => {
    const property = await tx.property.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!property || property.status === "ARCHIVED")
      throw new DomainError("NOT_FOUND", "Imóvel indisponível.");
    if (data.slug !== property.slug && property.status === "PUBLISHED")
      throw new DomainError(
        "CONFLICT",
        "Retire a publicação antes de alterar o endereço. O link anterior deixará de funcionar.",
      );
    if (
      data.brokerId &&
      !(await tx.broker.findFirst({
        where: {
          id: data.brokerId,
          organizationId: actor.organizationId,
          active: true,
        },
      }))
    )
      throw new DomainError(
        "VALIDATION",
        "Escolha um corretor ativo da sua imobiliária.",
      );
    await tx.property.update({
      where: {
        id_organizationId: { id, organizationId: actor.organizationId },
      },
      data,
    });
  });
  return data;
}
