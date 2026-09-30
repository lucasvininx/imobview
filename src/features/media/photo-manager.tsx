"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/hooks/use-hydrated";
import Image from "next/image";
import { Button } from "@/components/ui";
import {
  authorizePhotoAction,
  finalizePhotoAction,
  removePhotoAction,
} from "./actions";

export function PhotoManager({
  propertyId,
  photos,
  canEdit,
}: {
  propertyId: string;
  photos: { id: string; fileName: string; ready: boolean; url: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(work: () => Promise<void>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch {
      setError(
        "A conexão falhou. Retome a validação se o envio já terminou ou descarte o envio e tente novamente.",
      );
    } finally {
      setPending(false);
      router.refresh();
    }
  }
  return (
    <section className="form-card" aria-label="Fotos do imóvel">
      <h2>Fotos do imóvel</h2>
      <p>
        A primeira foto é a capa da página pública. Até 20 fotos JPEG, PNG ou
        WebP, com até 10 MB cada. Recomendamos fotos horizontais com 1920 px ou
        mais. As fotos de imóveis publicados ficam visíveis assim que o envio
        termina.
      </p>
      {canEdit && (
        <label className="field">
          Adicionar foto
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending || !hydrated}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (
                file.size > 10 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setError("Use JPEG, PNG ou WebP de até 10 MB.");
                return;
              }
              void run(async () => {
                const auth = await authorizePhotoAction({
                  propertyId,
                  fileName: file.name,
                  mimeType: file.type,
                  size: file.size,
                });
                if (!auth.success) {
                  setError(auth.error);
                  return;
                }
                setMessage("Enviando foto…");
                const response = await fetch(auth.url, {
                  method: "PUT",
                  headers: { "Content-Type": file.type, "x-upsert": "false" },
                  body: file,
                  signal: AbortSignal.timeout(180000),
                });
                if (!response.ok) throw new Error("upload");
                setMessage("Validando e otimizando…");
                const result = await finalizePhotoAction(auth.id);
                if (!result.success) {
                  setError(result.error);
                  setMessage("");
                  return;
                }
                setMessage("Foto adicionada.");
              });
            }}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!photos.length && <p>Nenhuma foto enviada.</p>}
      <div className="form-grid">
        {photos.map((photo, index) => (
          <article key={photo.id}>
            {photo.url && (
              <Image
                unoptimized
                src={photo.url}
                alt={photo.fileName}
                width={320}
                height={200}
                style={{
                  width: "100%",
                  height: 200,
                  objectFit: "cover",
                  borderRadius: 12,
                }}
              />
            )}
            <p>
              {index === 0 && photo.ready ? "Capa · " : ""}
              {photo.fileName}
              {!photo.ready ? " · Envio não concluído" : ""}
            </p>
            {canEdit && (
              <>
                {!photo.ready && (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      void run(async () => {
                        const result = await finalizePhotoAction(photo.id);
                        if (!result.success) setError(result.error);
                        else setMessage("Foto adicionada.");
                      })
                    }
                  >
                    Retomar validação
                  </Button>
                )}
                <Button
                  variant="quiet"
                  disabled={pending}
                  onClick={() => {
                    if (
                      confirm(
                        "Excluir esta foto? Ela deixará de aparecer na galeria pública.",
                      )
                    )
                      void run(async () => {
                        const result = await removePhotoAction(photo.id);
                        if (!result.success) setError(result.error);
                        else setMessage("Foto removida.");
                      });
                  }}
                >
                  Excluir foto
                </Button>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
