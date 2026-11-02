"use server";
import { requireWorkspace } from "@/server/session";
import { listNotifications, readNotifications } from "./service";

export async function notificationsAction() {
  const { actor } = await requireWorkspace();
  return listNotifications(actor);
}
export async function readNotificationsAction(id?: string) {
  const { actor } = await requireWorkspace();
  await readNotifications(actor, id);
  return listNotifications(actor);
}
