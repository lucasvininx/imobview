import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { can, type Permission, type Role } from "@/domain/permissions";
import { DomainError } from "@/domain/errors";

export type Actor = { userId: string; organizationId: string };

export async function withTenant<T>(
  actor: Actor,
  permission: Permission,
  work: (tx: Prisma.TransactionClient, role: Role) => Promise<T>,
): Promise<T> {
  if (!z.uuid().safeParse(actor.organizationId).success)
    throw new DomainError("FORBIDDEN", "Acesso não permitido.");
  return db.$transaction(async (tx) => {
    const membership = await tx.organizationMember.findUnique({
      where: { organizationId_userId: actor },
    });
    if (!membership || !can(membership.role, permission))
      throw new DomainError("FORBIDDEN", "Acesso não permitido.");
    await tx.$executeRaw`SELECT set_config('app.organization_id', ${actor.organizationId}, true), set_config('app.user_id', ${actor.userId}, true)`;
    return work(tx, membership.role);
  });
}
