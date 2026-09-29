"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createTourAction } from "./actions";
export function CreateTourButton({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = await createTourAction(propertyId, "Tour 360°");
            if (result.success)
              router.push(`/app/imoveis/${propertyId}/tours/${result.id}`);
            else setError(result.error);
          } catch {
            setError("Não foi possível criar o tour.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Criando…" : "Criar tour 360°"}
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
}
