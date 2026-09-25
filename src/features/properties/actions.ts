"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireWorkspace } from "@/server/session";
import { saveProperty, changePropertyStatus } from "./service";
import { DomainError } from "@/domain/errors";
import { logError } from "@/server/logger";

function friendlyError(error: unknown) {
  if (error instanceof DomainError) return error.message;
  if (error instanceof ZodError) return "Confira os campos e tente novamente.";
  logError("property.mutation.failed", error);
  return "Não foi possível salvar. Tente novamente em instantes.";
}
export async function savePropertyAction(input: unknown, id?: string) {
  const { actor } = await requireWorkspace();
  try {
    const property = await saveProperty(actor, input, id);
    revalidatePath("/app");
    revalidatePath("/app/imoveis");
    revalidatePath(`/app/imoveis/${property.id}`);
    revalidatePath(`/v/${property.slug}`);
    return { success: true as const, id: property.id };
  } catch (error) {
    return { success: false as const, error: friendlyError(error) };
  }
}
export async function changeStatusAction(id: string, status: unknown) {
  const { actor } = await requireWorkspace();
  try {
    const property = await changePropertyStatus(actor, id, status);
    revalidatePath("/app");
    revalidatePath("/app/imoveis");
    revalidatePath(`/app/imoveis/${id}`);
    revalidatePath(`/v/${property.slug}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: friendlyError(error) };
  }
}
