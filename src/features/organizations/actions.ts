"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/server/session";
import { db } from "@/server/db";
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
