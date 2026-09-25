"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui";
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      <Button
        variant="quiet"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            const result = await authClient.signOut();
            if (result.error) {
              setError(true);
              setPending(false);
            } else {
              router.push("/login");
              router.refresh();
            }
          } catch {
            setError(true);
            setPending(false);
          }
        }}
        aria-label="Sair da conta"
      >
        <LogOut size={17} />
        {pending ? "Saindo..." : "Sair da conta"}
      </Button>
      {error && (
        <span role="alert">Não foi possível sair. Tente novamente.</span>
      )}
    </>
  );
}
