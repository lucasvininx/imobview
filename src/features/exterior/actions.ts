"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireWorkspace } from "@/server/session";
import { DomainError } from "@/domain/errors";
import { logError } from "@/server/logger";
import { saveExterior } from "./service";

export async function saveExteriorAction(id: string, input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    const slug = await saveExterior(actor, id, input);
    revalidatePath(`/app/imoveis/${id}`);
    revalidatePath(`/v/${slug}`);
    return { success: true as const };
  } catch (error) {
    if (error instanceof DomainError)
      return { success: false as const, error: error.message };
    if (error instanceof ZodError)
      return {
        success: false as const,
        error: error.issues[0]?.message ?? "Confira os campos.",
      };
    logError("exterior.save.failed", error);
    return {
      success: false as const,
      error: "Não foi possível salvar. Tente novamente.",
    };
  }
}
