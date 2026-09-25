"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { changeStatusAction } from "./actions";
export function StatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function change(next: string) {
    if (
      next === "ARCHIVED" &&
      !window.confirm(
        "Arquivar este imóvel? A página pública ficará indisponível e o cadastro não poderá ser editado.",
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      const result = await changeStatusAction(id, next);
      if (!result.success) setError(result.error);
      else router.refresh();
    } catch {
      setError("Não foi possível atualizar. Tente novamente.");
    } finally {
      setPending(false);
    }
  }
  if (status === "ARCHIVED")
    return (
      <p className="notice">
        Este imóvel está arquivado e não é exibido publicamente.
      </p>
    );
  return (
    <>
      <div className="status-actions">
        <Button
          disabled={pending}
          onClick={() => change(status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}
        >
          {pending
            ? "Atualizando..."
            : status === "PUBLISHED"
              ? "Retirar publicação"
              : "Publicar imóvel"}
        </Button>
        <Button
          disabled={pending}
          variant="quiet"
          onClick={() => change("ARCHIVED")}
        >
          Arquivar imóvel
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
