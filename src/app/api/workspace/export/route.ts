import { requireWorkspace } from "@/server/session";
import { withTenant } from "@/server/tenant";
import { DomainError } from "@/domain/errors";
export const dynamic = "force-dynamic";
export async function GET() {
  const { actor } = await requireWorkspace();
  try {
    const data = await withTenant(actor, "organization:manage", async (tx) => ({
      exportedAt: new Date().toISOString(),
      organization: await tx.organization.findUnique({
        where: { id: actor.organizationId },
        select: { name: true, slug: true, contactEmail: true, whatsapp: true },
      }),
      properties: await tx.property.findMany({
        where: { organizationId: actor.organizationId },
        include: { photos: true, tours: { include: { assets: true } } },
      }),
    }));
    return new Response(
      JSON.stringify(
        data,
        (_key, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": "attachment; filename=imobview-export.json",
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof DomainError)
      return Response.json({ error: "Acesso não permitido." }, { status: 403 });
    throw error;
  }
}
