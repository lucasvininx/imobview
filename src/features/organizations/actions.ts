"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/server/session";
import { db } from "@/server/db";
import { requireWorkspace } from "@/server/session";
import { saveOrganizationContact } from "./service";
import { DomainError } from "@/domain/errors";
import { logError } from "@/server/logger";
import { revalidatePath } from "next/cache";

export async function saveContactAction(input: unknown) {
  const { actor } = await requireWorkspace();
  try {
    await saveOrganizationContact(actor, input);
    revalidatePath("/app/configuracoes");
    revalidatePath("/v/[slug]", "page");
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: error.issues[0].message };
    if (error instanceof DomainError)
      return { success: false as const, error: error.message };
    logError("organization.contact.failed", error);
    return {
      success: false as const,
      error: "Não foi possível salvar. Tente novamente.",
    };
  }
}
export async function switchWorkspace(form: FormData) {
  const session = await requireSession();
  const id = z.uuid().parse(form.get("organizationId"));
  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: id, userId: session.user.id },
    },
  });
  if (!membership) throw new Error("Acesso não permitido.");
  (await cookies()).set("imobview.workspace", id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/app");
}
