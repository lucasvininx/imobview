import "server-only";
import { withTenant, type Actor } from "@/server/tenant";
import { financingSettingsSchema, organizationContactSchema } from "./schema";

export function saveOrganizationContact(actor: Actor, input: unknown) {
  const data = organizationContactSchema.parse(input);
  return withTenant(actor, "organization:manage", (tx) =>
    tx.organization.update({ where: { id: actor.organizationId }, data }),
  );
}
export function saveFinancingSettings(actor: Actor, input: unknown) {
  const { financingRate } = financingSettingsSchema.parse(input);
  return withTenant(actor, "organization:manage", (tx) =>
    tx.organization.update({
      where: { id: actor.organizationId },
      data: { financingRateBps: financingRate },
    }),
  );
}
