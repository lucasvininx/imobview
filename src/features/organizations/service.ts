import "server-only";
import { withTenant, type Actor } from "@/server/tenant";
import { organizationContactSchema } from "./schema";

export function saveOrganizationContact(actor: Actor, input: unknown) {
  const data = organizationContactSchema.parse(input);
  return withTenant(actor, "organization:manage", (tx) =>
    tx.organization.update({ where: { id: actor.organizationId }, data }),
  );
}
