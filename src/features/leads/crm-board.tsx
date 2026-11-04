"use client";
import Link from "next/link";
import {
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { stageLabels, stageSchema } from "./schema";
import { InterestBadge } from "./interest";
import type { LeadInterest } from "./score";
import { moveLeadStageAction } from "./actions";

type Stage = keyof typeof stageLabels;
export type CrmLead = {
  id: string;
  name: string;
  stage: Stage;
  property: string;
  broker: string;
  interest: LeadInterest;
};
const colors: Record<Stage, string> = {
  NEW: "blue",
  TOUR_STARTED: "blue",
  TOUR_COMPLETED: "blue",
  INTERESTED: "amber",
  VISIT_REQUESTED: "amber",
  NEGOTIATION: "purple",
  PROPOSAL: "purple",
  WON: "green",
  LOST: "gray",
};
export function CrmBoard({
  leads,
  canMove,
}: {
  leads: CrmLead[];
  canMove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, optimisticMove] = useOptimistic(
    leads,
    (current, move: { id: string; stage: Stage }) =>
      current.map((lead) =>
        lead.id === move.id ? { ...lead, stage: move.stage } : lead,
      ),
  );
  const [dragged, setDragged] = useState<string | null>(null),
    [over, setOver] = useState<Stage | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>({
    text: "",
    error: false,
  });
  const saving = useRef(false),
    draggedId = useRef<string | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const pointer = useRef<{
    id: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  function resetDrag() {
    draggedId.current = null;
    pointer.current = null;
    setDragged(null);
    setOver(null);
  }
  function move(id: string, stage: Stage) {
    resetDrag();
    const lead = items.find((item) => item.id === id);
    if (!canMove || saving.current || !lead || lead.stage === stage) return;
    saving.current = true;
    setFeedback({ text: "", error: false });
    startTransition(async () => {
      optimisticMove({ id, stage });
      try {
        const result = await moveLeadStageAction(id, {
          stage,
          expectedStage: lead.stage,
        });
        setFeedback(
          result.success
            ? {
                text: `${lead.name}: status alterado para ${stageLabels[stage]}.`,
                error: false,
              }
            : { text: result.error, error: true },
        );
      } catch {
        setFeedback({
          text: "Falha de conexão. A alteração não foi confirmada. Tente novamente.",
          error: true,
        });
      } finally {
        router.refresh();
        saving.current = false;
      }
    });
  }
  function stageAt(x: number, y: number) {
    const element = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-crm-stage]");
    return element && board.current?.contains(element)
      ? stageSchema.safeParse(element.dataset.crmStage)
      : null;
  }
  function scrollAt(x: number) {
    if (!board.current) return;
    const rect = board.current.getBoundingClientRect();
    if (x > Math.min(rect.right, window.innerWidth) - 55)
      board.current.scrollLeft += 25;
    else if (x < Math.max(rect.left, 0) + 55) board.current.scrollLeft -= 25;
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = pointer.current;
    if (!drag) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7
    )
      return;
    drag.moved = true;
    setDragged(drag.id);
    scrollAt(event.clientX);
    const target = stageAt(event.clientX, event.clientY);
    setOver(target?.success ? target.data : null);
  }
  return (
    <>
      <div className="crm-board-help">
        <p>
          Arraste o contato para a etapa desejada. A mudança é salva
          automaticamente.
        </p>
        <span role={feedback.error ? "alert" : "status"} aria-live="polite">
          {pending ? "Salvando alteração…" : feedback.text}
        </span>
      </div>
      <div
        className={`crm-board${pending ? " crm-saving" : ""}`}
        ref={board}
        aria-busy={pending}
      >
        {stageSchema.options.map((stage) => {
          const cards = items.filter((lead) => lead.stage === stage);
          return (
            <section
              key={stage}
              className={`crm-column crm-${colors[stage]}${over === stage ? " crm-drop-target" : ""}`}
              data-crm-stage={stage}
              aria-label={stageLabels[stage]}
              onDragOver={(event) => {
                if (!draggedId.current || pending || !canMove) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOver(stage);
                scrollAt(event.clientX);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = draggedId.current;
                if (id) move(id, stage);
              }}
            >
              <h2>
                <span className="crm-dot" />
                {stageLabels[stage]}
                <small>{cards.length}</small>
              </h2>
              {cards.length ? (
                cards.map((lead) => (
                  <article
                    key={lead.id}
                    className={`crm-card${dragged === lead.id ? " crm-card-dragging" : ""}`}
                    data-lead-id={lead.id}
                    aria-label={`Lead ${lead.name}`}
                    draggable={canMove && !pending}
                    onDragStart={(event) => {
                      if (!canMove || pending) {
                        event.preventDefault();
                        return;
                      }
                      draggedId.current = lead.id;
                      setDragged(lead.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", lead.id);
                    }}
                    onDragEnd={resetDrag}
                  >
                    <div className="lead-card-top">
                      <InterestBadge interest={lead.interest} />
                      {canMove && (
                        <button
                          type="button"
                          className="crm-drag-handle"
                          aria-label={`Arrastar ${lead.name}`}
                          disabled={pending}
                          onPointerDown={(event) => {
                            if (event.button !== 0 || pending) return;
                            event.preventDefault();
                            event.currentTarget.setPointerCapture(
                              event.pointerId,
                            );
                            pointer.current = {
                              id: lead.id,
                              x: event.clientX,
                              y: event.clientY,
                              moved: false,
                            };
                          }}
                          onPointerMove={onPointerMove}
                          onPointerUp={(event) => {
                            const drag = pointer.current;
                            const target = stageAt(
                              event.clientX,
                              event.clientY,
                            );
                            if (
                              event.currentTarget.hasPointerCapture(
                                event.pointerId,
                              )
                            )
                              event.currentTarget.releasePointerCapture(
                                event.pointerId,
                              );
                            if (drag?.moved && target?.success)
                              move(drag.id, target.data);
                            else resetDrag();
                          }}
                          onPointerCancel={resetDrag}
                        >
                          <GripVertical size={18} />
                        </button>
                      )}
                    </div>
                    <h3>
                      <Link href={`/app/leads/${lead.id}`}>{lead.name}</Link>
                    </h3>
                    <p>{lead.property}</p>
                    <span>{lead.broker}</span>
                    {canMove && (
                      <label className="crm-stage-select">
                        Mover para
                        <select
                          aria-label={`Mover ${lead.name} para`}
                          value={lead.stage}
                          disabled={pending}
                          onChange={(event) =>
                            move(lead.id, stageSchema.parse(event.target.value))
                          }
                        >
                          {stageSchema.options.map((value) => (
                            <option key={value} value={value}>
                              {stageLabels[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <Link className="text-link" href={`/app/leads/${lead.id}`}>
                      Abrir contato ↗
                    </Link>
                  </article>
                ))
              ) : (
                <p className="crm-empty">
                  {dragged
                    ? "Solte o contato aqui"
                    : "Nenhum contato nesta etapa."}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
