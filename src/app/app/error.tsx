"use client";
import { Button } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="error-page">
      <h1>Não foi possível carregar seu espaço.</h1>
      <p>Tente novamente em instantes. Seus dados continuam salvos.</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
