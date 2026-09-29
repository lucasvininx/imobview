"use client";
import { useEffect, useRef, useState } from "react";
import type { Viewer } from "@photo-sphere-viewer/core";
import type { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import "./tour.css";
import { Button } from "@/components/ui";
import type { TourSceneView } from "./viewer-types";
export function TourViewer({
  scenes,
  initialSceneId,
  onSceneChange,
  onPositionSelect,
}: {
  scenes: TourSceneView[];
  initialSceneId?: string | null;
  onSceneChange?: (id: string) => void;
  onPositionSelect?: (position: { yaw: number; pitch: number }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tourRef = useRef<VirtualTourPlugin | null>(null);
  const callbacks = useRef({ onSceneChange, onPositionSelect });
  useEffect(() => {
    callbacks.current = { onSceneChange, onPositionSelect };
  }, [onSceneChange, onPositionSelect]);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(initialSceneId ?? scenes[0]?.id);
  const [retry, setRetry] = useState(0);
  const desiredScene = useRef(initialSceneId);
  useEffect(() => {
    desiredScene.current = initialSceneId;
    if (
      initialSceneId &&
      tourRef.current?.getCurrentNode()?.id !== initialSceneId
    ) {
      void tourRef.current
        ?.setCurrentNode(initialSceneId)
        .catch(() => setError("Não foi possível abrir este ambiente."));
    }
  }, [initialSceneId]);
  function navigate(id: string) {
    desiredScene.current = id;
    if (!started) {
      setStarted(true);
      return;
    }
    if (!tourRef.current || tourRef.current.getCurrentNode()?.id === id) return;
    setLoading(true);
    void tourRef.current
      .setCurrentNode(id)
      .catch(() => {
        setError("Não foi possível abrir este ambiente.");
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    if (!started || !container.current || !scenes.length) return;
    let cancelled = false;
    let instance: Viewer | undefined;
    Promise.all([
      import("@photo-sphere-viewer/core"),
      import("@photo-sphere-viewer/virtual-tour-plugin"),
    ])
      .then(([{ Viewer }, { VirtualTourPlugin }]) => {
        if (cancelled || !container.current) return;
        setLoading(true);
        setError("");
        const start =
          scenes.find((s) => s.id === desiredScene.current) ?? scenes[0];
        setActive(start.id);
        instance = new Viewer({
          container: container.current,
          navbar: ["zoom", "move", "fullscreen"],
          keyboard: "fullscreen",
          mousewheelCtrlKey: true,
          touchmoveTwoFingers: true,
          defaultYaw: start.initialYaw,
          defaultPitch: start.initialPitch,
          lang: {
            zoom: "Zoom",
            zoomOut: "Diminuir zoom",
            zoomIn: "Aumentar zoom",
            move: "Mover",
            moveUp: "Olhar para cima",
            moveDown: "Olhar para baixo",
            moveLeft: "Olhar para a esquerda",
            moveRight: "Olhar para a direita",
            fullscreen: "Tela cheia",
            loading: "Carregando panorama…",
            loadError: "Não foi possível carregar o panorama.",
            twoFingers: "Use dois dedos para navegar",
            ctrlZoom: "Segure Ctrl para usar o zoom",
          },
          plugins: [
            VirtualTourPlugin.withConfig({
              dataMode: "client",
              positionMode: "manual",
              renderMode: "2d",
              preload: false,
              showLinkTooltip: false,
              startNodeId: start.id,
              transitionOptions: { effect: "none", rotation: false },
              nodes: scenes.map((scene) => ({
                id: scene.id,
                panorama: scene.panoramaUrl,
                links: scene.hotspots.map((link) => ({
                  nodeId: link.targetSceneId,
                  position: { yaw: link.yaw, pitch: link.pitch },
                })),
              })),
            }),
          ],
        });
        viewerRef.current = instance;
        const tour = instance.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);
        tourRef.current = tour;
        tour.addEventListener("node-changed", ({ node }) => {
          desiredScene.current = node.id;
          setActive(node.id);
          setLoading(false);
          setError("");
          callbacks.current.onSceneChange?.(node.id);
        });
        instance.addEventListener("panorama-loaded", () => setLoading(false));
        instance.addEventListener("panorama-error", () => {
          setLoading(false);
          setError(
            "Não foi possível carregar este panorama. Recarregue a página para renovar o acesso às imagens.",
          );
        });
        instance.addEventListener("click", ({ data }) =>
          callbacks.current.onPositionSelect?.({
            yaw: data.yaw,
            pitch: data.pitch,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError(
            "O visualizador não pôde iniciar. Verifique se seu navegador tem suporte a WebGL.",
          );
        }
      });
    return () => {
      cancelled = true;
      instance?.destroy();
      viewerRef.current = null;
      tourRef.current = null;
    };
  }, [scenes, started, retry]);
  return (
    <section className="tour-viewer" aria-label="Tour virtual 360 graus">
      <div
        className="tour-canvas"
        ref={container}
        tabIndex={0}
        aria-label="Panorama interativo. Use os controles para mover ou ampliar."
      />
      {!started && (
        <div className="tour-start">
          <h2>Conheça cada ambiente.</h2>
          <p>Explore em 360° e navegue pelos pontos de conexão.</p>
          <Button onClick={() => setStarted(true)} disabled={!scenes.length}>
            Iniciar tour 360°
          </Button>
        </div>
      )}
      {loading && (
        <p role="status" className="tour-overlay">
          Carregando panorama…
        </p>
      )}
      {error && (
        <div role="alert" className="tour-overlay">
          <p>{error}</p>
          <Button onClick={() => setRetry(retry + 1)}>Tentar novamente</Button>
        </div>
      )}
      <div className="tour-scene-nav" aria-label="Ambientes do tour">
        {scenes.map((scene) => (
          <button
            type="button"
            key={scene.id}
            aria-pressed={active === scene.id}
            onClick={() => navigate(scene.id)}
          >
            {scene.title}
          </button>
        ))}
      </div>
      <p className="tour-help" aria-live="polite">
        {scenes.find((s) => s.id === active)?.title} · Arraste para olhar ao
        redor. No celular, use dois dedos. Os ambientes também estão disponíveis
        pelos botões acima.
      </p>
      {started && (
        <div className="tour-scene-nav" aria-label="Conexões do ambiente">
          {scenes
            .find((s) => s.id === active)
            ?.hotspots.map((link) => (
              <button
                type="button"
                key={link.id}
                onClick={() => navigate(link.targetSceneId)}
              >
                Ir para {link.label} →
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
