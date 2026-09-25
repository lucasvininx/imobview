import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export const requireSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
});

export const requireWorkspace = cache(async () => {
  const session = await requireSession();
  const memberships = await db.organizationMember.findMany({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  const selectedId = (await cookies()).get("imobview.workspace")?.value;
  const membership =
    memberships.find((member) => member.organizationId === selectedId) ??
    memberships[0];
  if (!membership) redirect("/onboarding");
  return {
    actor: {
      userId: session.user.id,
      organizationId: membership.organizationId,
    },
    user: session.user,
    membership,
    memberships,
  };
});
