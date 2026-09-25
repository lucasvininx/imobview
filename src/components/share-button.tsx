"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "./ui";
export function ShareButton() {
  const [message, setMessage] = useState("");
  return (
    <>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setMessage("Link copiado para compartilhar.");
          } catch {
            setMessage("Copie o endereço da página no seu navegador.");
          }
        }}
      >
        <Share2 size={15} />
        Copiar link
      </Button>
      {message && <p role="status">{message}</p>}
    </>
  );
}
