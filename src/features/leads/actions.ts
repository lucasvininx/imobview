"use server";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/server/session";
import {
  updateLead,
  deleteLead,
  updateRequest,
  saveLeadProfile,
} from "./service";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { after } from "next/server";
import { deliverWhatsApp } from "@/features/notifications/whatsapp";
import { logError } from "@/server/logger";
export async function saveLeadProfileAction(input: unknown, id?: string) {
  const { actor } = await requireWorkspace();
  try {
    const lead = await saveLeadProfile(actor, input, id);
    revalidatePath("/app", "layout");
    return { success: true as const, id: lead.id };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Confira os dados.")
          : error instanceof DomainError
            ? error.message
            : "Não foi possível salvar. Tente novamente.",
    };
  }
}
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
    after(async () => {
      try {
        await deliverWhatsApp();
      } catch (error) {
        logError("whatsapp.dispatch.failed", error);
      }
    });
    revalidatePath("/app", "layout");
    return { success: true as const };
  } catch {
    return {
      success: false as const,
      error: "Não foi possível atualizar a solicitação.",
    };
  }
}
