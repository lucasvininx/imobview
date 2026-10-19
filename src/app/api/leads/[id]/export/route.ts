import { requireWorkspace } from "@/server/session";
import { getLead } from "@/features/leads/service";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { actor } = await requireWorkspace();
  const { id } = await params;
  try {
    const lead = await getLead(actor, id);
    return Response.json(lead, {
      headers: {
        "Content-Disposition": "attachment; filename=lead.json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "Lead indisponível." }, { status: 404 });
  }
}
