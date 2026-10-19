import "server-only";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";
export const brokerSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.email().max(254),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{10,15}$/)),
});
export function listBrokers(actor: Actor) {
  return withTenant(actor, "property:read", (tx) =>
    tx.broker.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
      take: 100,
    }),
  );
}
export function createBroker(actor: Actor, input: unknown) {
  const data = brokerSchema.parse(input);
  return withTenant(actor, "organization:manage", async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Organization" WHERE id=${actor.organizationId}::uuid FOR UPDATE`;
    if (
      (await tx.broker.count({
        where: { organizationId: actor.organizationId },
      })) >= 100
    )
      throw new Error("BrokerLimit");
    return tx.broker.create({
      data: { ...data, organizationId: actor.organizationId },
    });
  });
}
export function deactivateBroker(actor: Actor, id: string) {
  z.uuid().parse(id);
  return withTenant(actor, "organization:manage", (tx) =>
    tx.broker.updateMany({
      where: { id, organizationId: actor.organizationId },
      data: { active: false },
    }),
  );
}
