"use server";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/server/session";
import { updateLead, deleteLead, updateRequest } from "./service";
import { DomainError } from "@/domain/errors";
export async function leadAction(id: string, input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    await updateLead(actor, id, input);
    revalidatePath("/app", "layout");
    return { success: true as const };
  } catch (e) {
    return {
      success: false as const,
      error:
        e instanceof DomainError
          ? e.message
          : "Confira os dados e tente novamente.",
    };
  }
}
export async function deleteLeadAction(id: string, confirmation: string) {
  const { actor } = await requireWorkspace();
  if (confirmation !== "EXCLUIR")
    return { success: false as const, error: "Digite EXCLUIR para confirmar." };
  try {
    await deleteLead(actor, id);
    revalidatePath("/app", "layout");
    return { success: true as const };
  } catch {
    return {
      success: false as const,
      error: "Não foi possível excluir este lead.",
    };
  }
}
export async function requestStatusAction(id: string, status: string) {
  const { actor } = await requireWorkspace();
  try {
    await updateRequest(actor, id, status);
    revalidatePath("/app", "layout");
    return { success: true as const };
  } catch {
    return {
      success: false as const,
      error: "Não foi possível atualizar a solicitação.",
    };
  }
}
