"use client";
import Image from "next/image";
import { useState } from "react";
import type { FloorPlanView } from "./viewer-types";
import type { TourDocument } from "./schema";

type PlanScene = Pick<
  TourDocument["scenes"][number],
  "id" | "title" | "planPosition"
>;

// Shared by the public tour (click a room to go there) and the editor (click the drawing to place a room).
export function FloorPlanMap({
  plans,
  scenes,
  activeSceneId,
  onSelectScene,
  onPlace,
}: {
  plans: FloorPlanView[];
  scenes: PlanScene[];
  activeSceneId?: string;
  onSelectScene?: (sceneId: string) => void;
  onPlace?: (position: { planId: string; x: number; y: number }) => void;
}) {
  const activePlan = scenes.find((scene) => scene.id === activeSceneId)
    ?.planPosition?.planId;
  // A manual floor choice lasts until the visitor moves to another room.
  const [chosen, setChosen] = useState<{ scene?: string; plan: string }>();
  const currentId =
    chosen && chosen.scene === activeSceneId
      ? chosen.plan
      : (activePlan ?? plans[0]?.id);
  const plan = plans.find((item) => item.id === currentId) ?? plans[0];
  if (!plan) return null;
  const markers = scenes.filter(
    (scene) => scene.planPosition?.planId === plan.id,
  );
  return (
    <div className="floor-plan">
      {plans.length > 1 && (
        <div className="floor-plan-tabs" aria-label="Pavimentos">
          {plans.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={item.id === plan.id}
              onClick={() => setChosen({ scene: activeSceneId, plan: item.id })}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}
      <div
        className={`floor-plan-canvas${onPlace ? " floor-plan-placing" : ""}`}
        onClick={(event) => {
          if (!onPlace) return;
          const box = event.currentTarget.getBoundingClientRect();
          const clamp = (value: number) => Math.min(1, Math.max(0, value));
          onPlace({
            planId: plan.id,
            x: clamp((event.clientX - box.left) / box.width),
            y: clamp((event.clientY - box.top) / box.height),
          });
        }}
      >
        <Image
          src={plan.url}
          unoptimized
          alt={`Planta baixa: ${plan.title}`}
          width={1200}
          height={900}
          draggable={false}
        />
        {markers.map((scene) => (
          <button
            type="button"
            key={scene.id}
            className={[
              "floor-plan-marker",
              scene.planPosition!.y < 0.25 && "floor-plan-marker-below",
              scene.planPosition!.x < 0.2 && "floor-plan-marker-start",
              scene.planPosition!.x > 0.8 && "floor-plan-marker-end",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${scene.planPosition!.x * 100}%`,
              top: `${scene.planPosition!.y * 100}%`,
            }}
            aria-label={`Abrir ${scene.title} pela planta`}
            aria-current={scene.id === activeSceneId ? "location" : undefined}
            disabled={!onSelectScene}
            onClick={(event) => {
              event.stopPropagation();
              onSelectScene?.(scene.id);
            }}
          >
            <span>{scene.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
