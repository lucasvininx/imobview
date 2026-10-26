import { requireWorkspace } from "@/server/session";
import { getLead } from "@/features/leads/service";
import { DomainError } from "@/domain/errors";
import { logError } from "@/server/logger";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor } = await requireWorkspace();
  const { id } = await params;
  let lead;
  try {
    lead = await getLead(actor, id);
  } catch (error) {
    if (
      error instanceof DomainError ||
      (error instanceof Error && error.name === "ZodError")
    )
      return Response.json({ error: "Lead indisponível." }, { status: 404 });
    logError("lead.export.failed", error);
    return Response.json(
      { error: "Não foi possível exportar." },
      { status: 500 },
    );
  }
  // Financing simulations store money as BigInt, which JSON cannot encode natively.
  return new Response(
    JSON.stringify(
      lead,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=lead.json",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
