"use client";
import { useEffect, useMemo, useState } from "react";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { tourDocumentSchema } from "./schema";
import { Button } from "@/components/ui";
import { TourViewer } from "./viewer";
import { PhotoGuide } from "./photo-guide";
import { type TourDocument, MAX_PANORAMA_BYTES } from "./schema";
import {
  authorizePanoramaAction,
  finalizePanoramaAction,
  saveTourAction,
  publishTourAction,
  removePanoramaAction,
} from "./actions";
type Asset = { id: string; fileName: string; url: string };
export function TourEditor({
  id,
  initialTitle,
  initialDocument,
  initialVersion,
  initialStatus,
  initialAssets,
  incompleteAssets,
  canEdit,
  canPublish,
  storageReady,
}: {
  id: string;
  initialTitle: string;
  initialDocument: TourDocument;
  initialVersion: number;
  initialStatus: string;
  initialAssets: Asset[];
  incompleteAssets: { id: string; fileName: string }[];
  canEdit: boolean;
  canPublish: boolean;
  storageReady: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [doc, setDoc] = useState(initialDocument);
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState(initialStatus);
  const [selected, setSelected] = useState(
    doc.initialSceneId ?? doc.scenes[0]?.id ?? "",
  );
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [position, setPosition] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);
  const [target, setTarget] = useState("");
  const scenes = useMemo(
    () =>
      doc.scenes.flatMap((scene) => {
        const asset = initialAssets.find((asset) => asset.id === scene.assetId);
        return asset?.url ? [{ ...scene, panoramaUrl: asset.url }] : [];
      }),
    [doc, initialAssets],
  );
  const scene = doc.scenes.find((scene) => scene.id === selected);
  useUnsavedChanges(dirty);
  useEffect(() => {
    if (!dirty) return;
    try {
      sessionStorage.setItem(
        `tour-draft:${id}`,
        JSON.stringify({ version, title, document: doc }),
      );
    } catch {
      /* Manual save remains available when browser storage is disabled. */
    }
  }, [dirty, id, version, title, doc]);
  function recover() {
    try {
      const raw: unknown = JSON.parse(
        sessionStorage.getItem(`tour-draft:${id}`) ?? "null",
      );
      if (
        !raw ||
        typeof raw !== "object" ||
        !("version" in raw) ||
        raw.version !== version ||
        !("title" in raw) ||
        typeof raw.title !== "string" ||
        !("document" in raw)
      ) {
        setError(
          "Não há rascunho recuperável para esta versão. Alterações de outra versão não sobrescrevem o servidor.",
        );
        return;
      }
      setDoc(tourDocumentSchema.parse(raw.document));
      setTitle(raw.title);
      setDirty(true);
      setMessage("Alterações recuperadas deste navegador. Revise e salve.");
    } catch {
      setError("Não foi possível recuperar o rascunho local.");
    }
  }
  function update(next: TourDocument) {
    setDoc(next);
    setDirty(true);
    setMessage("");
  }
  async function save() {
    setError("");
    const result = await saveTourAction({ id, version, title, document: doc });
    if (!result.success) {
      setError(result.error);
      return null;
    }
    setVersion(result.version);
    setDirty(false);
    try {
      sessionStorage.removeItem(`tour-draft:${id}`);
    } catch {}
    setMessage("Rascunho salvo.");
    return result.version;
  }
  async function run(action: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await action();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setPending(false);
    }
  }
  async function upload(file: File) {
    if (dirty) {
      setError("Salve o rascunho antes de enviar um panorama.");
      return;
    }
    if (
      file.size > MAX_PANORAMA_BYTES ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Use JPEG, PNG ou WebP com até 20 MB.");
      return;
    }
    await run(async () => {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      const valid = width === height * 2 && width >= 1024 && width <= 8192;
      bitmap.close();
      if (!valid) {
        setError(
          `Recebemos ${width} × ${height} pixels. Use uma foto 360° completa em proporção 2:1, por exemplo 4096 × 2048 px, com largura entre 1024 e 8192 px. Não recorte uma foto comum para adaptar.`,
        );
        return;
      }
      const authorized = await authorizePanoramaAction({
        tourId: id,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      });
      if (!authorized.success) {
        setError(authorized.error);
        return;
      }
      setUploadProgress(0);
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", authorized.url);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.setRequestHeader("x-upsert", "false");
          xhr.timeout = 180000;
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable)
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error("upload"));
          xhr.onerror = () => reject(new Error("network"));
          xhr.ontimeout = () => reject(new Error("timeout"));
          xhr.send(file);
        });
        setMessage("Upload concluído. Validando o panorama…");
        const result = await finalizePanoramaAction(authorized.id);
        if (!result.success) {
          setError(result.error);
          return;
        }
        window.location.reload();
      } finally {
        setUploadProgress(null);
      }
    });
  }
  return (
    <div className="tour-editor">
      <PhotoGuide />
      {canEdit && (
        <Button variant="quiet" disabled={pending} onClick={recover}>
          Recuperar alterações deste navegador
        </Button>
      )}
      {incompleteAssets.length > 0 && (
        <section className="tour-panel">
          <h2>Envios não concluídos</h2>
          <p>
            Você pode retomar a validação de um arquivo enviado ou removê-lo
            para liberar o limite.
          </p>
          {incompleteAssets.map((asset) => (
            <div key={asset.id}>
              <p>{asset.fileName}</p>
              <Button
                disabled={pending || dirty}
                onClick={() =>
                  void run(async () => {
                    const result = await finalizePanoramaAction(asset.id);
                    if (!result.success) setError(result.error);
                    else window.location.reload();
                  })
                }
              >
                Retomar validação
              </Button>
              <Button
                variant="quiet"
                disabled={pending || dirty}
                onClick={() =>
                  void run(async () => {
                    const result = await removePanoramaAction(asset.id);
                    if (!result.success) setError(result.error);
                    else window.location.reload();
                  })
                }
              >
                Descartar envio
              </Button>
            </div>
          ))}
        </section>
      )}
      <div className="notice">
        Envie panoramas 360° equiretangulares (2:1). Fotos comuns não produzem
        um ambiente 360° fiel. Alterações só aparecem para visitantes depois de
        publicar.
      </div>
      {!storageReady && (
        <p className="form-error" role="status">
          Conexão com Supabase Storage pendente. O editor está disponível; os
          uploads serão liberados após configurar o projeto correto.
        </p>
      )}
      <div className="tour-toolbar">
        {canEdit && (
          <Button
            disabled={pending || uploadProgress !== null}
            onClick={() =>
              void run(async () => {
                await save();
              })
            }
          >
            {pending ? "Aguarde…" : "Salvar rascunho"}
          </Button>
        )}
        {canPublish && (
          <>
            <Button
              disabled={pending || !storageReady}
              onClick={() =>
                void run(async () => {
                  const current = dirty ? await save() : version;
                  if (current === null) return;
                  const result = await publishTourAction(id, current, true);
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  setVersion(result.version);
                  setStatus("PUBLISHED");
                  setMessage(
                    "Tour publicado. Ele aparece na página do imóvel quando o imóvel também estiver publicado.",
                  );
                })
              }
            >
              Publicar tour
            </Button>
            {status === "PUBLISHED" && (
              <Button
                variant="quiet"
                disabled={pending}
                onClick={() =>
                  void run(async () => {
                    const result = await publishTourAction(id, version, false);
                    if (!result.success) setError(result.error);
                    else {
                      setVersion(result.version);
                      setStatus("DRAFT");
                      setMessage("Publicação retirada.");
                    }
                  })
                }
              >
                Retirar publicação
              </Button>
            )}
          </>
        )}
        <span className="badge">
          {dirty
            ? "Alterações não salvas"
            : status === "PUBLISHED"
              ? "Publicado"
              : "Rascunho"}
        </span>
      </div>
      {message && (
        <p role="status" className="form-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="tour-editor-grid">
        <aside>
          <div className="tour-panel">
            <label className="field">
              Nome do tour
              <input
                disabled={!canEdit || pending}
                maxLength={120}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
            {canEdit && (
              <label className="field">
                Enviar panorama
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={pending || !storageReady}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                    event.target.value = "";
                  }}
                />
                <span className="muted">
                  Até 20 MB · JPEG, PNG ou WebP · Máximo 30 ambientes
                </span>
              </label>
            )}
            {uploadProgress !== null && (
              <p role="status">Enviando: {uploadProgress}%</p>
            )}
            <h2>Ambientes</h2>
            <div className="tour-rooms">
              {doc.scenes.map((item) => (
                <button
                  className="tour-room"
                  key={item.id}
                  aria-pressed={selected === item.id}
                  onClick={() => {
                    setSelected(item.id);
                    setPosition(null);
                  }}
                >
                  {item.title}
                  {item.id === doc.initialSceneId ? " · Inicial" : ""}
                </button>
              ))}
            </div>
            {!doc.scenes.length && (
              <p>Envie um panorama e adicione seu primeiro ambiente abaixo.</p>
            )}
          </div>
          {canEdit && (
            <div className="tour-panel">
              <h2>Panoramas disponíveis</h2>
              {initialAssets
                .filter(
                  (asset) =>
                    !doc.scenes.some((scene) => scene.assetId === asset.id),
                )
                .map((asset) => (
                  <div key={asset.id}>
                    <p>{asset.fileName}</p>
                    <Button
                      variant="quiet"
                      disabled={pending || dirty}
                      onClick={() => {
                        if (confirm("Excluir este panorama sem uso?"))
                          void run(async () => {
                            const result = await removePanoramaAction(asset.id);
                            if (!result.success) setError(result.error);
                            else window.location.reload();
                          });
                      }}
                    >
                      Excluir panorama
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={pending || doc.scenes.length >= 30}
                      onClick={() => {
                        const sceneId = crypto.randomUUID();
                        update({
                          ...doc,
                          initialSceneId: doc.initialSceneId ?? sceneId,
                          scenes: [
                            ...doc.scenes,
                            {
                              id: sceneId,
                              assetId: asset.id,
                              title: `Ambiente ${doc.scenes.length + 1}`,
                              initialYaw: 0,
                              initialPitch: 0,
                              hotspots: [],
                            },
                          ],
                        });
                        setSelected(sceneId);
                      }}
                    >
                      Adicionar ambiente
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </aside>
        <div>
          {scenes.length > 0 ? (
            <TourViewer
              scenes={scenes}
              initialSceneId={selected}
              onSceneChange={(sceneId) => {
                setSelected(sceneId);
                setPosition(null);
                setTarget("");
              }}
              onPositionSelect={canEdit ? setPosition : undefined}
            />
          ) : (
            <div className="empty-state">
              <h2>O tour começa com um panorama.</h2>
              <p>Adicione os ambientes para montar sua visita virtual.</p>
            </div>
          )}
          {scene && canEdit && (
            <div className="tour-panel">
              <h2>Editar ambiente</h2>
              <label className="field">
                Nome do ambiente
                <input
                  maxLength={80}
                  disabled={pending}
                  value={scene.title}
                  onChange={(event) =>
                    update({
                      ...doc,
                      scenes: doc.scenes.map((item) =>
                        item.id === selected
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              <div className="tour-toolbar">
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => update({ ...doc, initialSceneId: selected })}
                >
                  Usar como ambiente inicial
                </Button>
                <Button
                  variant="quiet"
                  disabled={pending}
                  onClick={() => {
                    if (
                      !confirm(
                        "Remover este ambiente e seus pontos de conexão do rascunho?",
                      )
                    )
                      return;
                    const remaining = doc.scenes
                      .filter((item) => item.id !== selected)
                      .map((item) => ({
                        ...item,
                        hotspots: item.hotspots.filter(
                          (link) => link.targetSceneId !== selected,
                        ),
                      }));
                    update({
                      scenes: remaining,
                      initialSceneId:
                        doc.initialSceneId === selected
                          ? (remaining[0]?.id ?? null)
                          : doc.initialSceneId,
                    });
                    setSelected(remaining[0]?.id ?? "");
                  }}
                >
                  Remover ambiente
                </Button>
              </div>
              <h2>Conectar a outro ambiente</h2>
              <p>
                Clique no panorama para marcar a posição do ponto de navegação.
              </p>
              {position && (
                <p className="notice">
                  Posição selecionada. Escolha o destino e adicione a conexão.
                </p>
              )}
              <label className="field">
                Ambiente de destino
                <select
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Selecione um ambiente</option>
                  {doc.scenes
                    .filter((item) => item.id !== selected)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                disabled={
                  !position ||
                  !target ||
                  pending ||
                  target === selected ||
                  scene.hotspots.length >= 50
                }
                onClick={() => {
                  if (!position) return;
                  const destination = doc.scenes.find(
                    (item) => item.id === target,
                  );
                  if (!destination) return;
                  update({
                    ...doc,
                    scenes: doc.scenes.map((item) =>
                      item.id === selected
                        ? {
                            ...item,
                            hotspots: [
                              ...item.hotspots,
                              {
                                id: crypto.randomUUID(),
                                targetSceneId: target,
                                label: destination.title,
                                ...position,
                              },
                            ],
                          }
                        : item,
                    ),
                  });
                  setPosition(null);
                }}
              >
                Adicionar ponto clicável
              </Button>
              <ul className="tour-links">
                {scene.hotspots.map((link) => (
                  <li key={link.id}>
                    <span>→ {link.label}</span>
                    <Button
                      variant="quiet"
                      disabled={pending}
                      onClick={() =>
                        update({
                          ...doc,
                          scenes: doc.scenes.map((item) =>
                            item.id === selected
                              ? {
                                  ...item,
                                  hotspots: item.hotspots.filter(
                                    (point) => point.id !== link.id,
                                  ),
                                }
                              : item,
                          ),
                        })
                      }
                    >
                      Remover ponto
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
