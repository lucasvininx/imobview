"use server";
import { requireWorkspace } from "@/server/session";
import { listNotifications, readNotifications } from "./service";
import { z } from "zod";

export async function notificationsAction(unreadOnly = false) {
  const { actor } = await requireWorkspace();
  return listNotifications(actor, z.boolean().parse(unreadOnly));
}
export async function readNotificationsAction(id?: string, unreadOnly = false) {
  const { actor } = await requireWorkspace();
  const filter = z.boolean().parse(unreadOnly);
  await readNotifications(actor, id);
  return listNotifications(actor, filter);
}
