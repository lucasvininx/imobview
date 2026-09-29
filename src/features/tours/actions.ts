"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireWorkspace } from "@/server/session";
import { DomainError } from "@/domain/errors";
import { logError } from "@/server/logger";
import {
  authorizePanorama,
  createTour,
  finalizePanorama,
  publishTour,
  saveTour,
  removePanorama,
} from "./service";
function message(error: unknown) {
  if (error instanceof DomainError) return error.message;
  if (error instanceof ZodError)
    return error.issues[0]?.message ?? "Confira os campos.";
  logError("tour.action.failed", error);
  return "Não foi possível concluir. Tente novamente.";
}
export async function removePanoramaAction(id: string) {
  const { actor } = await requireWorkspace();
  try {
    await removePanorama(actor, id);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: message(error) };
  }
}
export async function createTourAction(propertyId: string, title: string) {
  const { actor } = await requireWorkspace();
  try {
    const tour = await createTour(actor, propertyId, title);
    revalidatePath(`/app/imoveis/${propertyId}`);
    return { success: true as const, id: tour.id };
  } catch (error) {
    return { success: false as const, error: message(error) };
  }
}
export async function saveTourAction(input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    const version = await saveTour(actor, input);
    return { success: true as const, version };
  } catch (error) {
    return { success: false as const, error: message(error) };
  }
}
export async function publishTourAction(
  id: string,
  version: number,
  publish: boolean,
) {
  const { actor } = await requireWorkspace();
  try {
    const nextVersion = await publishTour(actor, id, version, publish);
    revalidatePath("/v/[slug]", "page");
    return { success: true as const, version: nextVersion };
  } catch (error) {
    return { success: false as const, error: message(error) };
  }
}
export async function authorizePanoramaAction(input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    return {
      success: true as const,
      ...(await authorizePanorama(actor, input)),
    };
  } catch (error) {
    return { success: false as const, error: message(error) };
  }
}
export async function finalizePanoramaAction(id: string) {
  const { actor } = await requireWorkspace();
  try {
    const asset = await finalizePanorama(actor, id);
    return { success: true as const, id: asset.id };
  } catch (error) {
    return { success: false as const, error: message(error) };
  }
}
