import "server-only";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";
import { DomainError } from "@/domain/errors";
import { whatsappConfigured } from "@/features/notifications/whatsapp";

const settingsSchema = z.object({
  leadDistribution: z.enum(["PROPERTY", "ROUND_ROBIN", "PERFORMANCE"]),
  whatsappVisitAlerts: z.boolean(),
});
export function saveDistribution(actor: Actor, input: unknown) {
  const data = settingsSchema.parse(input);
  if (data.whatsappVisitAlerts && !whatsappConfigured())
    throw new DomainError(
      "VALIDATION",
      "Configure a integração WhatsApp no servidor antes de ativar os avisos.",
    );
  return withTenant(actor, "organization:manage", async (tx) => {
    const [existing] = await tx.$queryRaw<
      { leadDistribution: string }[]
    >`SELECT "leadDistribution" FROM "Organization" WHERE id=${actor.organizationId}::uuid FOR UPDATE`;
    if (existing.leadDistribution !== data.leadDistribution)
      await tx.broker.updateMany({
        where: { organizationId: actor.organizationId },
        data: { leadCredit: 0, lastLeadAt: null },
      });
    return tx.organization.update({
      where: { id: actor.organizationId },
      data,
    });
  });
}
