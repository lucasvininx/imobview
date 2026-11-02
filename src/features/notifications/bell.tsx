"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";
import { notificationsAction, readNotificationsAction } from "./actions";

type Feed = Awaited<ReturnType<typeof notificationsAction>>;
export function NotificationBell({
  initial,
  workspaceId,
}: {
  initial: Feed;
  workspaceId: string;
}) {
  const [feed, setFeed] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      setFeed(await notificationsAction());
      setError("");
    } catch {
      setError("Não foi possível atualizar as notificações.");
    }
  }, []);
  useEffect(() => {
    const interval = setInterval(() => void refresh(), 30000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const onClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        root.current?.querySelector("#notification-panel")
      ) {
        setOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("pointerdown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [refresh, workspaceId]);
  async function mark(id?: string) {
    setBusy(true);
    try {
      setFeed(await readNotificationsAction(id));
      setError("");
    } catch {
      setError("Não foi possível marcar como lida.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="notification-root" ref={root}>
      <button
        className="notification-toggle"
        aria-label={`Notificações: ${feed.unread} não lidas`}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen(!open);
          if (!open) void refresh();
        }}
      >
        <Bell size={22} />
        {feed.unread > 0 && (
          <span className="notification-count">
            {feed.unread > 99 ? "99+" : feed.unread}
          </span>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {feed.unread} notificações não lidas
      </span>
      {open && (
        <section
          id="notification-panel"
          className="notification-panel"
          aria-label="Notificações"
        >
          <div className="notification-heading">
            <h2>Notificações</h2>
            <button
              className="notification-toggle"
              aria-label="Fechar notificações"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          {feed.unread > 0 && (
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => void mark()}
            >
              <CheckCheck size={18} /> Marcar todas como lidas
            </button>
          )}
          {error && <p role="alert">{error}</p>}
          {!feed.items.length && <p>Nenhuma notificação por enquanto.</p>}
          <ul>
            {feed.items.map((item) => (
              <li
                key={item.id}
                className={item.readAt ? "" : "notification-unread"}
              >
                <Link
                  href={`/app/leads/${item.leadId}`}
                  onClick={() => {
                    void mark(item.id);
                    setOpen(false);
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <time dateTime={new Date(item.createdAt).toISOString()}>
                    {new Date(item.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </time>
                </Link>
                {!item.readAt && (
                  <button
                    className="button button-quiet"
                    aria-label={`Marcar como lida: ${item.title}`}
                    disabled={busy}
                    onClick={() => void mark(item.id)}
                  >
                    Marcar como lida
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">
            Últimas 30 notificações · atualização a cada 30 segundos.
          </p>
        </section>
      )}
    </div>
  );
}
