"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui";
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const data = new FormData(event.currentTarget);
        try {
          const result = await authClient.signIn.email({
            email: String(data.get("email")),
            password: String(data.get("password")),
            rememberMe: data.get("remember") === "on",
          });
          if (result.error) {
            setError(
              result.error.status === 429
                ? "Muitas tentativas. Aguarde um minuto e tente novamente."
                : "E-mail ou senha inválidos. Confira seus dados.",
            );
          } else {
            router.push("/app");
            router.refresh();
          }
        } catch {
          setError("Não foi possível conectar. Tente novamente.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        E-mail
        <input
          required
          type="email"
          name="email"
          placeholder="voce@imobiliaria.com.br"
          autoComplete="email"
          maxLength={254}
        />
      </label>
      <label className="field">
        Senha
        <input
          required
          type={visible ? "text" : "password"}
          name="password"
          placeholder="Sua senha"
          autoComplete="current-password"
          maxLength={128}
        />
      </label>
      <div className="form-meta">
        <label>
          <input name="remember" type="checkbox" defaultChecked /> Lembrar de
          mim
        </label>
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="text-link"
          style={{ margin: 0, fontSize: 11 }}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          {visible ? "Ocultar senha" : "Mostrar senha"}
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Entrando..." : "Entrar na plataforma"}
        <ArrowUpRight size={16} />
      </Button>
      <div className="form-meta">
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
        <span>Conexão segura</span>
      </div>
    </form>
  );
}
