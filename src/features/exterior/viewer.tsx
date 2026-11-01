"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type * as Three from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui";
import {
  buildLayout,
  clock,
  dailySun,
  duration,
  facadeSun,
  type Box,
} from "./layout";
import { localInstant, sunDirection, sunPosition } from "./sun";
import { facadeLabels, type ExteriorConfig } from "./schema";

type Scene = {
  applySun: (date: string, minutes: number) => void;
  fly: (view: "drone" | "top" | "unit" | "street") => void;
};
const sunStates = {
  sun: "Sol batendo na fachada do apartamento agora.",
  shaded: "Agora a fachada está na sombra de um prédio vizinho.",
  behind: "Agora o sol está do outro lado do prédio.",
  night: "Noite: o sol está abaixo do horizonte.",
} as const;

function today(utcOffset: number) {
  return new Date(Date.now() + utcOffset * 3600000).toISOString().slice(0, 10);
}

export function ExteriorViewer({
  config,
  title,
}: {
  config: ExteriorConfig;
  title: string;
}) {
  const layout = useMemo(() => buildLayout(config), [config]);
  const container = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const compass = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState(() => today(config.utcOffset));
  const [minutes, setMinutes] = useState(10 * 60);
  const [playing, setPlaying] = useState(false);
  const timeId = useId();
  const year = date.slice(0, 4);
  const presets = [
    ["Hoje", today(config.utcOffset)],
    ["Verão", `${year}-12-21`],
    ["Outono", `${year}-03-20`],
    ["Inverno", `${year}-06-21`],
    ["Primavera", `${year}-09-22`],
  ] as const;
  const day = useMemo(
    () => dailySun(layout, config, date),
    [layout, config, date],
  );
  const now = facadeSun(
    layout,
    localInstant(date, minutes, config.utcOffset),
    config,
  );

  useEffect(() => sceneRef.current?.applySun(date, minutes), [date, minutes]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setMinutes((value) => (value >= 19 * 60 ? 5 * 60 : value + 10)),
      120,
    );
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (!started || !container.current) return;
    let disposed = false;
    let cleanup = () => {};
    Promise.all([
      import("three"),
      import("three/examples/jsm/controls/OrbitControls.js"),
    ])
      .then(([THREE, { OrbitControls: Controls }]) => {
        if (disposed || !container.current) return;
        cleanup = mount(THREE, Controls, container.current);
      })
      .catch(() =>
        setError(
          "A vista 3D não pôde iniciar. Verifique se seu navegador tem suporte a WebGL.",
        ),
      );
    return () => {
      disposed = true;
      cleanup();
      sceneRef.current = null;
    };

    function mount(
      THREE: typeof Three,
      Controls: typeof OrbitControls,
      host: HTMLDivElement,
    ) {
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      host.appendChild(renderer.domElement);
      renderer.domElement.setAttribute(
        "aria-label",
        "Maquete 3D do condomínio. Arraste para girar, use a roda ou dois dedos para aproximar.",
      );
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xa9d4f5, 260, 620);
      const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1500);
      const controls = new Controls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI / 2 - 0.03;
      controls.minDistance = 12;
      controls.maxDistance = 320;
      const height = config.floors * 3;
      controls.target.set(0, height * 0.35, 0);
      camera.position.set(95, height + 45, 125);
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.addEventListener("start", () => (controls.autoRotate = false));

      const mats: Three.Material[] = [];
      const geos: Three.BufferGeometry[] = [];
      const textures: Three.Texture[] = [];
      const material = <T extends Three.Material>(m: T) => (mats.push(m), m);
      const geometry = <T extends Three.BufferGeometry>(g: T) => (
        geos.push(g),
        g
      );
      function canvasTexture(
        w: number,
        h: number,
        draw: (c: CanvasRenderingContext2D) => void,
      ) {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        draw(canvas.getContext("2d")!);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        textures.push(texture);
        return texture;
      }
      // A tile of 8 bays x 8 floors: slab bands and glass; at night only some windows are lit.
      const TILE = 8;
      const facadeMap = canvasTexture(64 * TILE, 48 * TILE, (c) => {
        c.fillStyle = "#e9e4da";
        c.fillRect(0, 0, 64 * TILE, 48 * TILE);
        for (let bx = 0; bx < TILE; bx++)
          for (let fy = 0; fy < TILE; fy++) {
            c.fillStyle = "#5f7d8f";
            c.fillRect(bx * 64 + 6, fy * 48 + 10, 52, 30);
            c.fillStyle = "#88a6b6";
            c.fillRect(bx * 64 + 6, fy * 48 + 10, 52, 9);
          }
      });
      const litMap = canvasTexture(64 * TILE, 48 * TILE, (c) => {
        c.fillStyle = "#000";
        c.fillRect(0, 0, 64 * TILE, 48 * TILE);
        let seed = 7;
        for (let bx = 0; bx < TILE; bx++)
          for (let fy = 0; fy < TILE; fy++) {
            seed = (seed * 48271) % 2147483647;
            if (seed / 2147483647 > 0.45) continue;
            c.fillStyle = seed % 3 ? "#ffd59a" : "#fff1d6";
            c.fillRect(bx * 64 + 6, fy * 48 + 10, 52, 30);
          }
      });
      facadeMap.repeat.set(4 / TILE, config.floors / TILE);
      litMap.repeat.set(4 / TILE, config.floors / TILE);
      const facade = material(
        new THREE.MeshStandardMaterial({
          map: facadeMap,
          emissiveMap: litMap,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0,
          roughness: 0.8,
        }),
      );
      const neighbourFacades: Three.MeshStandardMaterial[] = [];
      const roof = material(
        new THREE.MeshStandardMaterial({ color: 0xbfb9ae, roughness: 0.9 }),
      );
      const add = (mesh: Three.Mesh, cast = true, receive = true) => {
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
        scene.add(mesh);
        return mesh;
      };
      const boxMesh = (box: Box, mat: Three.Material | Three.Material[]) => {
        const size = box.max.map((v, i) => v - box.min[i]);
        const mesh = new THREE.Mesh(
          geometry(new THREE.BoxGeometry(size[0], size[1], size[2])),
          mat,
        );
        mesh.position.set(
          ...(box.min.map((v, i) => v + size[i] / 2) as [
            number,
            number,
            number,
          ]),
        );
        return mesh;
      };

      // Ground, lot, streets and sidewalks.
      const flat = (
        w: number,
        d: number,
        color: number,
        x: number,
        z: number,
        y: number,
      ) => {
        const mesh = new THREE.Mesh(
          geometry(new THREE.PlaneGeometry(w, d)),
          material(new THREE.MeshStandardMaterial({ color, roughness: 1 })),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, y, z);
        return add(mesh, false, true);
      };
      flat(1400, 1400, 0x8fa877, 0, 0, -0.02);
      flat(86, 86, 0xd9d3c7, 0, 0, 0);
      for (const s of [-1, 1]) {
        flat(14, 220, 0x4b4f54, s * 52, 0, 0.01);
        flat(220, 14, 0x4b4f54, 0, s * 52, 0.01);
        flat(2.5, 220, 0xc9c4ba, s * 44.5, 0, 0.02);
        flat(220, 2.5, 0xc9c4ba, 0, s * 44.5, 0.02);
      }
      for (const tower of layout.towers)
        add(boxMesh(tower, [facade, facade, roof, roof, facade, facade]));
      // Neighbours reuse the facade pattern, scaled to their own size and tinted.
      const tints = [0xffffff, 0xe6ebef, 0xf4ece0, 0xdfe4e2];
      layout.neighbours.forEach((box, i) => {
        const w = Math.max(box.max[0] - box.min[0], box.max[2] - box.min[2]);
        const h = box.max[1] - box.min[1];
        const map = facadeMap.clone();
        const lit = litMap.clone();
        map.repeat.set(
          Math.max(1, Math.round(w / 4)) / TILE,
          Math.max(1, Math.round(h / 3)) / TILE,
        );
        // Offset each building so lit windows do not repeat in the same pattern.
        map.offset.set((i * 0.37) % 1, (i * 0.61) % 1);
        lit.offset.copy(map.offset);
        lit.repeat.copy(map.repeat);
        textures.push(map, lit);
        const side = material(
          new THREE.MeshStandardMaterial({
            map,
            emissiveMap: lit,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 0,
            color: tints[i % tints.length],
            roughness: 0.85,
          }),
        );
        neighbourFacades.push(side);
        add(boxMesh(box, [side, side, roof, roof, side, side]));
      });

      const trunk = material(
        new THREE.MeshStandardMaterial({ color: 0x7a5a3c }),
      );
      const leaves = material(
        new THREE.MeshStandardMaterial({ color: 0x4f7d45, roughness: 1 }),
      );
      const trunkGeo = geometry(new THREE.CylinderGeometry(0.25, 0.35, 3, 6));
      const crownGeo = geometry(new THREE.SphereGeometry(2.2, 10, 8));
      const tree = (x: number, z: number, scale = 1) => {
        const t = add(new THREE.Mesh(trunkGeo, trunk));
        t.position.set(x, 1.5 * scale, z);
        t.scale.setScalar(scale);
        const c = add(new THREE.Mesh(crownGeo, leaves));
        c.position.set(x, 3.8 * scale, z);
        c.scale.setScalar(scale);
      };
      for (let a = -36; a <= 36; a += 12) {
        tree(a, -41);
        tree(a, 41);
        tree(-41, a);
        tree(41, a);
      }
      for (const item of layout.placed) {
        const b = item.box;
        const cx = (b.min[0] + b.max[0]) / 2,
          cz = (b.min[2] + b.max[2]) / 2;
        const w = b.max[0] - b.min[0],
          d = b.max[2] - b.min[2];
        if (item.kind === "pool") {
          add(
            boxMesh(
              {
                min: [b.min[0] - 1, 0, b.min[2] - 1],
                max: [b.max[0] + 1, 0.25, b.max[2] + 1],
              },
              material(new THREE.MeshStandardMaterial({ color: 0xf2efe8 })),
            ),
            false,
          );
          const water = flat(w, d, 0x3fa7d6, cx, cz, 0.27);
          (water.material as Three.MeshStandardMaterial).roughness = 0.15;
        } else if (item.kind === "court") {
          const map = canvasTexture(120, 180, (c) => {
            c.fillStyle = "#3f7f6b";
            c.fillRect(0, 0, 120, 180);
            c.strokeStyle = "#f4f4f0";
            c.lineWidth = 3;
            c.strokeRect(8, 8, 104, 164);
            c.beginPath();
            c.moveTo(8, 90);
            c.lineTo(112, 90);
            c.stroke();
            c.beginPath();
            c.arc(60, 90, 16, 0, Math.PI * 2);
            c.stroke();
          });
          map.repeat.set(1, 1);
          const court = flat(w, d, 0xffffff, cx, cz, 0.05);
          (court.material as Three.MeshStandardMaterial).map = map;
        } else if (item.kind === "playground") {
          flat(w, d, 0xd99a5b, cx, cz, 0.05);
          [
            [-2, -2, 0xe2574c, 1.6],
            [2, -1, 0xf2c14e, 2.4],
            [0, 2.5, 0x4c8fe2, 1.2],
          ].forEach(([dx, dz, color, h]) =>
            add(
              boxMesh(
                {
                  min: [cx + dx - 0.9, 0, cz + dz - 0.9],
                  max: [cx + dx + 0.9, h, cz + dz + 0.9],
                },
                material(new THREE.MeshStandardMaterial({ color })),
              ),
            ),
          );
        } else {
          flat(w, d, 0x6f9b5a, cx, cz, 0.05);
          [
            [-3, -3],
            [3, -2],
            [-2, 3],
            [3, 3],
            [0, 0],
          ].forEach(([dx, dz], i) =>
            tree(cx + dx, cz + dz, 0.7 + (i % 3) * 0.15),
          );
        }
      }

      // The apartment, highlighted on its facade.
      const unitMat = material(
        new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x10b981,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.9,
        }),
      );
      add(boxMesh(layout.unit, unitMat), false, false);
      const unitPoint = new THREE.Vector3(...layout.unitCentre).addScaledVector(
        new THREE.Vector3(...layout.normal),
        2,
      );

      // Lights, sky and the sun's path for the chosen day.
      const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b6a58, 1);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 2.5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, {
        left: -130,
        right: 130,
        top: 130,
        bottom: -130,
        near: 10,
        far: 700,
      });
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.6;
      scene.add(sun, sun.target);
      const disc = new THREE.Mesh(
        geometry(new THREE.SphereGeometry(7, 16, 12)),
        material(new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false })),
      );
      scene.add(disc);
      const pathMat = material(
        new THREE.LineDashedMaterial({
          color: 0xffd36b,
          dashSize: 6,
          gapSize: 4,
          fog: false,
        }),
      );
      let path: Three.Line | null = null;
      const sky = {
        night: new THREE.Color(0x0d1a2c),
        dusk: new THREE.Color(0xe9a173),
        day: new THREE.Color(0xa9d4f5),
      };
      const background = new THREE.Color();
      let pathDate = "";
      function applySun(date: string, minutes: number) {
        const position = sunPosition(
          localInstant(date, minutes, config.utcOffset),
          config.latitude,
          config.longitude,
        );
        const d = sunDirection(position);
        const dir = new THREE.Vector3(d.x, d.y, d.z);
        const up = Math.max(0, position.altitude);
        const strength = Math.min(1, up / 0.25);
        sun.position.copy(dir).multiplyScalar(320);
        sun.intensity = 2.8 * strength;
        sun.color.setHSL(0.1, 0.9 - 0.6 * strength, 0.65 + 0.3 * strength);
        hemi.intensity =
          0.25 +
          0.85 * Math.min(1, Math.max(0, (position.altitude + 0.1) / 0.35));
        background
          .copy(sky.night)
          .lerp(
            sky.dusk,
            Math.min(1, Math.max(0, (position.altitude + 0.12) / 0.14)),
          );
        background.lerp(sky.day, Math.min(1, up / 0.3));
        scene.background = background;
        scene.fog!.color.copy(background);
        const lights =
          0.9 *
          (1 - Math.min(1, Math.max(0, (position.altitude + 0.05) / 0.15)));
        facade.emissiveIntensity = lights;
        // Fewer lit windows in the neighbourhood than in the highlighted condominium.
        for (const side of neighbourFacades)
          side.emissiveIntensity = lights * 0.55;
        disc.visible = position.altitude > -0.02;
        disc.position.copy(dir).multiplyScalar(420);
        if (date !== pathDate) {
          pathDate = date;
          const points: Three.Vector3[] = [];
          for (let m = 0; m <= 24 * 60; m += 10) {
            const p = sunPosition(
              localInstant(date, m, config.utcOffset),
              config.latitude,
              config.longitude,
            );
            if (p.altitude < -0.02) continue;
            const v = sunDirection(p);
            points.push(new THREE.Vector3(v.x, v.y, v.z).multiplyScalar(420));
          }
          if (path) {
            scene.remove(path);
            path.geometry.dispose();
          }
          path = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            pathMat,
          );
          path.computeLineDistances();
          scene.add(path);
        }
      }

      let tween: {
        from: Three.Vector3[];
        to: Three.Vector3[];
        start: number;
      } | null = null;
      function fly(view: "drone" | "top" | "unit" | "street") {
        controls.autoRotate = false;
        const n = new THREE.Vector3(...layout.normal);
        const target =
          view === "unit" || view === "street"
            ? new THREE.Vector3(...layout.unitCentre)
            : new THREE.Vector3(0, height * 0.35, 0);
        const position =
          view === "top"
            ? new THREE.Vector3(0.01, height + 190, 0.01)
            : view === "unit"
              ? new THREE.Vector3(...layout.unitCentre)
                  .addScaledVector(n, 42)
                  .add(new THREE.Vector3(n.z * 14, 6, -n.x * 14))
              : view === "street"
                ? new THREE.Vector3(...layout.unitCentre)
                    .setY(1.7)
                    .addScaledVector(n, 36)
                : new THREE.Vector3(95, height + 45, 125);
        tween = {
          from: [camera.position.clone(), controls.target.clone()],
          to: [position, target],
          start: performance.now(),
        };
      }

      const projected = new THREE.Vector3();
      let frame = 0;
      const resize = () => {
        const { clientWidth: w, clientHeight: h } = host;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      // Draw only while the view is on screen and the tab is visible: an idle
      // WebGL loop drains batteries and, without a GPU, the whole CPU.
      let onScreen = true;
      const running = () => onScreen && document.visibilityState === "visible";
      const resume = () => {
        if (running() && !frame) frame = requestAnimationFrame(loop);
      };
      const visibility = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        resume();
      });
      visibility.observe(host);
      document.addEventListener("visibilitychange", resume);
      const loop = (time: number) => {
        if (!running()) {
          frame = 0;
          return;
        }
        frame = requestAnimationFrame(loop);
        if (tween) {
          const k = Math.min(1, (time - tween.start) / 900);
          const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          camera.position.lerpVectors(tween.from[0], tween.to[0], e);
          controls.target.lerpVectors(tween.from[1], tween.to[1], e);
          if (k === 1) tween = null;
        }
        controls.update();
        unitMat.emissiveIntensity = 0.45 + 0.35 * Math.sin(time / 380);
        projected.copy(unitPoint).project(camera);
        if (label.current) {
          const visible =
            projected.z < 1 &&
            Math.abs(projected.x) < 1.1 &&
            Math.abs(projected.y) < 1.1;
          label.current.style.opacity = visible ? "1" : "0";
          label.current.style.transform = `translate(-50%, -130%) translate(${((projected.x + 1) / 2) * host.clientWidth}px, ${((1 - projected.y) / 2) * host.clientHeight}px)`;
        }
        if (compass.current)
          compass.current.style.transform = `rotate(${(controls.getAzimuthalAngle() * 180) / Math.PI}deg)`;
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(loop);
      sceneRef.current = { applySun, fly };
      applySun(date, minutes);
      return () => {
        cancelAnimationFrame(frame);
        visibility.disconnect();
        document.removeEventListener("visibilitychange", resume);
        observer.disconnect();
        controls.dispose();
        path?.geometry.dispose();
        geos.forEach((g) => g.dispose());
        mats.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    }
    // The scene is rebuilt only when the configuration changes; time updates use applySun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, layout, config]);

  return (
    <section className="exterior" aria-labelledby="vista-externa">
      <h2 id="vista-externa">Vista 3D do condomínio</h2>
      <p className="muted">
        Gire em volta como um drone, veja o entorno e escolha o dia e o horário
        para descobrir onde bate o sol.
      </p>
      <div className="exterior-stage">
        <div className="exterior-canvas" ref={container} />
        {started && (
          <>
            <div className="exterior-label" ref={label} aria-hidden="true">
              <strong>{config.buildingName || title}</strong>
              <span>
                Apartamento · {config.unitFloor}º andar
                {config.towers > 1 ? ` · Torre ${config.unitTower}` : ""}
              </span>
            </div>
            <div className="exterior-compass" aria-hidden="true">
              <div ref={compass}>
                <span>N</span>
              </div>
            </div>
            <div className="exterior-views" aria-label="Posições da câmera">
              {(
                [
                  ["drone", "Drone"],
                  ["unit", "Ver o apartamento"],
                  ["top", "Vista de cima"],
                  ["street", "Nível da rua"],
                ] as const
              ).map(([view, text]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => sceneRef.current?.fly(view)}
                >
                  {text}
                </button>
              ))}
            </div>
          </>
        )}
        {!started && (
          <div className="exterior-start">
            <Button onClick={() => setStarted(true)}>Explorar em 3D</Button>
          </div>
        )}
        {error && (
          <p role="alert" className="tour-overlay">
            {error}
          </p>
        )}
      </div>
      <div className="exterior-controls">
        <div className="exterior-dates" role="group" aria-label="Época do ano">
          {presets.map(([text, value]) => (
            <button
              key={text}
              type="button"
              aria-pressed={date === value}
              onClick={() => setDate(value)}
            >
              {text}
            </button>
          ))}
          <label className="field">
            Data
            <input
              type="date"
              value={date}
              required
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="field exterior-time">
          <label htmlFor={timeId}>
            Horário: <output htmlFor={timeId}>{clock(minutes)}</output>
          </label>
          <input
            id={timeId}
            type="range"
            min={5 * 60}
            max={19 * 60}
            step={10}
            value={minutes}
            aria-valuetext={clock(minutes)}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
        </div>
        <Button variant="secondary" onClick={() => setPlaying(!playing)}>
          {playing ? "Pausar o dia" : "Ver o dia passar"}
        </Button>
      </div>
      <div className="exterior-sun" aria-live="polite">
        <p>
          <strong>
            Fachada {facadeLabels[config.unitFacade].toLowerCase()} ·{" "}
            {day.minutes
              ? `${duration(day.minutes)} de sol direto neste dia`
              : "sem sol direto neste dia"}
          </strong>
          {day.intervals.length > 0 &&
            ` (${day.intervals.map((i) => `${clock(i.start)} às ${clock(i.end)}`).join(" e ")})`}
        </p>
        <p className="muted">{sunStates[now]}</p>
      </div>
      <p className="muted exterior-note">
        Maquete ilustrativa gerada a partir das informações do imóvel: os
        prédios vizinhos são representativos. A posição do sol é calculada para
        a localização aproximada do empreendimento e não considera nuvens,
        árvores ou construções futuras.
      </p>
    </section>
  );
}
