"use server";
import { requireWorkspace } from "@/server/session";
import { revalidatePath } from "next/cache";
import { createBroker, deactivateBroker } from "./brokers";
export async function saveBrokerAction(input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    await createBroker(actor, input);
    revalidatePath("/app/equipe");
    return { success: true as const };
  } catch {
    return {
      success: false as const,
      error:
        "Confira nome, e-mail e telefone. Limite de 100 corretores por imobiliária.",
    };
  }
}
export async function deactivateBrokerAction(id: string) {
  const { actor } = await requireWorkspace();
  try {
    await deactivateBroker(actor, id);
    revalidatePath("/app/equipe");
    return { success: true as const };
  } catch {
    return { success: false as const };
  }
}
