"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui";
export function PasswordForm({ token }: { token?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        setMessage("");
        const data = new FormData(event.currentTarget);
        try {
          const result = token
            ? await authClient.resetPassword({
                token,
                newPassword: String(data.get("password")),
              })
            : await authClient.requestPasswordReset({
                email: String(data.get("email")),
                redirectTo: "/redefinir-senha",
              });
          if (result.error)
            setError(
              token
                ? "Este link expirou ou já foi utilizado. Solicite um novo link."
                : "Não foi possível enviar agora. Tente novamente mais tarde.",
            );
          else
            setMessage(
              token
                ? "Senha atualizada. Você já pode entrar com sua nova senha."
                : "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
            );
        } catch {
          setError("Não foi possível conectar. Tente novamente.");
        } finally {
          setPending(false);
        }
      }}
    >
      {token ? (
        <label className="field">
          Nova senha
          <input
            type="password"
            name="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
            placeholder="Pelo menos 12 caracteres"
          />
        </label>
      ) : (
        <label className="field">
          E-mail
          <input
            type="email"
            name="email"
            maxLength={254}
            autoComplete="email"
            required
            placeholder="voce@imobiliaria.com.br"
          />
        </label>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={pending || (!!token && !!message)}>
        {pending
          ? "Aguarde..."
          : token
            ? "Salvar nova senha"
            : "Enviar link de recuperação"}
      </Button>
    </form>
  );
}
