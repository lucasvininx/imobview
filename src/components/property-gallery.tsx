"use client";
import Image from "next/image";
import { useState } from "react";
export function PropertyGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="public-gallery">
      <Image
        src={images[active]}
        alt={`${title} — ambiente ${active + 1}`}
        fill
        priority
        sizes="100vw"
      />
      {images.length > 1 && (
        <div className="gallery-switcher" aria-label="Ambientes">
          {images.map((image, index) => (
            <button
              key={image}
              onClick={() => setActive(index)}
              aria-pressed={active === index}
            >
              Ambiente {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
