"use server";
import { requireWorkspace } from "@/server/session";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { ProviderError, sendWhatsApp } from "./providers";
import {
  calendarsForUser,
  disableIntegration,
  disconnectCalendar,
  retryIntegrations,
  saveIntegration,
  scheduleVisit,
  selectCalendar,
  getSettings,
  integrationTestBudget,
} from "./service";
import { deliverIntegrations } from "./delivery";
import { deliverWhatsApp } from "@/features/notifications/whatsapp";
import { logError } from "@/server/logger";
import type { WhatsAppSettings } from "./schema";

function failure(error: unknown) {
  const provider: Record<string, string> = {
    WHATSAPP_TEMPLATE_INVALID:
      "O modelo precisa estar aprovado, no idioma escolhido, e conter os cinco campos indicados no guia.",
    HTTP_401:
      "A credencial foi recusada. Confira a chave ou autorize a conta novamente.",
    HTTP_403:
      "O provedor recusou a permissão. Confira o domínio, as permissões da conta e o guia de conexão.",
    HTTP_400:
      "O provedor recusou a configuração. Confira as credenciais e as instruções abaixo.",
    GOOGLE_RECONNECT: "Autorize novamente sua conta Google.",
    GOOGLE_SCOPES_MISSING:
      "Autorize as permissões de agenda solicitadas para continuar.",
  };
  return {
    success: false as const,
    error:
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Confira os campos.")
        : error instanceof DomainError
          ? error.message
          : error instanceof ProviderError
            ? (provider[error.code] ??
              "O provedor não respondeu como esperado. Confira a configuração e tente novamente.")
            : "Não foi possível concluir. Confira a conexão e tente novamente.",
  };
}
export async function testWhatsAppAction(input: unknown) {
  const { actor, user } = await requireWorkspace();
  try {
    const settings = await getSettings<WhatsAppSettings>(
      actor,
      "WHATSAPP",
      true,
    );
    if (!settings?.enabled)
      throw new DomainError("CONFLICT", "Valide e ative o WhatsApp primeiro.");
    let phone = z.string().max(24).parse(input).replace(/\D/g, "");
    if (phone.length === 10 || phone.length === 11) phone = "55" + phone;
    if (!/^[1-9]\d{10,14}$/.test(phone))
      throw new DomainError(
        "VALIDATION",
        "Informe o WhatsApp de teste com DDI e DDD.",
      );
    await integrationTestBudget(actor, "WHATSAPP");
    await sendWhatsApp(settings.credentials, phone, [
      "Teste de conexão",
      user.name,
      "ImobView",
      new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      "Mensagem de teste",
    ]);
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function saveIntegrationAction(provider: string, input: unknown) {
  const { actor, user } = await requireWorkspace();
  try {
    const result = await saveIntegration(actor, provider, input, user.email);
    revalidatePath("/app/integracoes", "layout");
    revalidatePath("/app/configuracoes");
    return { success: true as const, ...result };
  } catch (error) {
    return failure(error);
  }
}
export async function disableIntegrationAction(provider: string) {
  const { actor } = await requireWorkspace();
  try {
    await disableIntegration(actor, provider);
    revalidatePath("/app/integracoes", "layout");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function disconnectCalendarAction() {
  const { actor } = await requireWorkspace();
  try {
    await disconnectCalendar(actor);
    revalidatePath("/app/integracoes", "layout");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function calendarsAction() {
  const { actor } = await requireWorkspace();
  try {
    return { success: true as const, calendars: await calendarsForUser(actor) };
  } catch (error) {
    return failure(error);
  }
}
export async function selectCalendarAction(id: string) {
  const { actor } = await requireWorkspace();
  try {
    await selectCalendar(actor, id);
    revalidatePath("/app/integracoes", "layout");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function scheduleVisitAction(
  input: unknown,
  requestId?: string,
  leadId?: string,
) {
  const { actor } = await requireWorkspace();
  try {
    const visit = await scheduleVisit(actor, input, requestId, leadId);
    after(async () => {
      const outcomes = await Promise.allSettled([
        deliverIntegrations(actor.organizationId, visit.id),
        deliverWhatsApp(),
      ]);
      for (const outcome of outcomes)
        if (outcome.status === "rejected")
          logError("visit.dispatch.failed", outcome.reason);
    });
    revalidatePath("/app", "layout");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function retryIntegrationsAction() {
  const { actor } = await requireWorkspace();
  try {
    await retryIntegrations(actor);
    after(async () => {
      await deliverIntegrations(actor.organizationId);
    });
    revalidatePath("/app/integracoes", "layout");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
