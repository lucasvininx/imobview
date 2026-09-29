"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/server/session";
import { DomainError } from "@/domain/errors";
import { logError } from "@/server/logger";
import { authorizePhoto, finalizePhoto, removePhoto } from "./service";

function failure(error: unknown) {
  if (error instanceof DomainError)
    return { success: false as const, error: error.message };
  if (error instanceof z.ZodError)
    return {
      success: false as const,
      error: "Use JPEG, PNG ou WebP de até 10 MB.",
    };
  logError("photo.action.failed", error);
  return {
    success: false as const,
    error: "Não foi possível concluir. Tente novamente.",
  };
}
export async function authorizePhotoAction(input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    return { success: true as const, ...(await authorizePhoto(actor, input)) };
  } catch (error) {
    return failure(error);
  }
}
export async function finalizePhotoAction(id: string) {
  const { actor } = await requireWorkspace();
  try {
    await finalizePhoto(actor, id);
    revalidatePath("/v/[slug]", "page");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function removePhotoAction(id: string) {
  const { actor } = await requireWorkspace();
  try {
    await removePhoto(actor, id);
    revalidatePath("/v/[slug]", "page");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
