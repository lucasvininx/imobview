"use server";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/server/session";
import { saveCommercial } from "./commercial-service";
import { DomainError } from "@/domain/errors";
export async function saveCommercialAction(id: string, input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    const data = await saveCommercial(actor, id, input);
    revalidatePath("/app", "layout");
    revalidatePath(`/v/${data.slug}`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof DomainError
          ? error.message
          : "Confira os campos. A URL deve ser única e conter apenas letras minúsculas, números e hífens.",
    };
  }
}
