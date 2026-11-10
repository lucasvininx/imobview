"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

export function PropertyGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  if (!images.length) return null;
  const index = Math.min(active, images.length - 1);
  const change = (step: number) =>
    setActive((current) => (current + step + images.length) % images.length);
  const photo = (i: number, large = false) => (
    <Image
      src={images[i]}
      alt={`${title} — foto ${i + 1}`}
      fill
      unoptimized={/^https?:/.test(images[i])}
      sizes={large ? "100vw" : "(max-width: 700px) 100vw, 60vw"}
      preload={i === 0 && !large}
    />
  );
  return (
    <section
      className="property-photo-section"
      aria-label="Fotos do imóvel"
      id="fotos-imovel"
    >
      <div className="property-photo-grid">
        {images.slice(0, 5).map((src, i) => (
          <button
            type="button"
            className="property-photo-tile"
            key={`${src}-${i}`}
            aria-label={`Ampliar foto ${i + 1} de ${images.length}`}
            onClick={() => {
              setActive(i);
              dialog.current?.showModal();
            }}
          >
            {photo(i)}
            {i === Math.min(4, images.length - 1) && (
              <span className="photo-count">
                <Images size={17} /> Ver {images.length} fotos
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="photo-hint">
        Clique nas fotos para ampliar e conhecer os detalhes de cada ambiente.
      </p>
      <dialog
        ref={dialog}
        className="property-lightbox"
        aria-label={`Fotos de ${title}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            change(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            change(-1);
          }
        }}
      >
        <div className="lightbox-toolbar">
          <span aria-live="polite">
            Foto {index + 1} de {images.length}
          </span>
          <button
            type="button"
            autoFocus
            aria-label="Fechar fotos"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <div className="lightbox-stage">{photo(index, true)}</div>
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="lightbox-prev"
              aria-label="Foto anterior"
              onClick={() => change(-1)}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="lightbox-next"
              aria-label="Próxima foto"
              onClick={() => change(1)}
            >
              <ChevronRight />
            </button>
            <div className="lightbox-thumbnails" aria-label="Escolher foto">
              {images.map((src, i) => (
                <button
                  type="button"
                  key={`${src}-${i}`}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-pressed={index === i}
                  onClick={() => setActive(i)}
                >
                  {photo(i, true)}
                </button>
              ))}
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
