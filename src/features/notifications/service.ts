import "server-only";
import { z } from "zod";
import { withTenant, type Actor } from "@/server/tenant";

export function listNotifications(actor: Actor) {
  return withTenant(actor, "lead:read", async (tx) => {
    const where = {
      organizationId: actor.organizationId,
      userId: actor.userId,
    };
    const [items, unread] = await Promise.all([
      tx.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      tx.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, unread };
  });
}

export function readNotifications(actor: Actor, id?: string) {
  if (id) z.uuid().parse(id);
  return withTenant(actor, "lead:read", (tx) =>
    tx.notification.updateMany({
      where: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        readAt: null,
        ...(id ? { id } : {}),
      },
      data: { readAt: new Date() },
    }),
  );
}
