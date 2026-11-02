"use server";
import { requireWorkspace } from "@/server/session";
import { revalidatePath } from "next/cache";
import { saveDistribution } from "./distribution";
import { DomainError } from "@/domain/errors";
export async function saveDistributionAction(input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    await saveDistribution(actor, input);
    revalidatePath("/app/configuracoes");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof DomainError
          ? error.message
          : "Não foi possível salvar as configurações. Confira os dados e tente novamente.",
    };
  }
}
