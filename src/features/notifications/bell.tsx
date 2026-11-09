"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  BellOff,
  CalendarDays,
  Check,
  CheckCheck,
  RefreshCw,
  RotateCcw,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
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
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const sequence = useRef(0);
  const inFlight = useRef<number | null>(null);
  const marking = useRef(false);
  const filter = useRef(false);
  const visibleItems = unreadOnly
    ? feed.items.filter((item) => !item.readAt)
    : feed.items;
  const refresh = useCallback(
    async (onlyUnread = filter.current, force = false) => {
      if (
        document.visibilityState !== "visible" ||
        marking.current ||
        (inFlight.current !== null && !force)
      )
        return;
      const request = ++sequence.current;
      inFlight.current = request;
      setLoading(true);
      try {
        const next = await notificationsAction(onlyUnread);
        if (request === sequence.current) {
          setFeed(next);
          setError("");
        }
      } catch {
        if (request === sequence.current)
          setError(
            "Não foi possível atualizar. Suas notificações continuam salvas.",
          );
      } finally {
        if (request === sequence.current) setLoading(false);
        if (inFlight.current === request) inFlight.current = null;
      }
    },
    [],
  );
  useEffect(() => {
    const requests = sequence;
    const interval = setInterval(() => void refresh(), 30000);
    const onFocus = () => void refresh();
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
        toggle.current?.focus();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      requests.current++;
      inFlight.current = null;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("pointerdown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [refresh, workspaceId]);
  async function mark(id?: string) {
    if (marking.current) return;
    marking.current = true;
    const request = ++sequence.current;
    setBusy(true);
    setLoading(false);
    try {
      const next = await readNotificationsAction(id, filter.current);
      if (request === sequence.current) {
        setFeed(next);
        setError("");
      }
    } catch {
      if (request === sequence.current)
        setError("Não foi possível marcar como lida. Tente novamente.");
    } finally {
      marking.current = false;
      setBusy(false);
    }
  }
  function close() {
    setOpen(false);
    toggle.current?.focus();
  }
  return (
    <div className="notification-root" ref={root}>
      <button
        ref={toggle}
        className="notification-toggle"
        data-unread={feed.unread > 0 || undefined}
        aria-label={`Notificações: ${feed.unread} não lidas`}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen(!open);
          if (!open) void refresh();
        }}
      >
        <Bell size={20} strokeWidth={1.8} aria-hidden="true" />
        {feed.unread > 0 && (
          <span className="notification-count" aria-hidden="true">
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
            <div>
              <h2>Notificações</h2>
              <p>
                {feed.unread
                  ? `${feed.unread} ${feed.unread === 1 ? "nova atualização" : "novas atualizações"}`
                  : "Você está em dia"}
              </p>
            </div>
            <button
              className="notification-icon-button"
              aria-label="Fechar notificações"
              onClick={close}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="notification-toolbar">
            <div
              className="notification-filters"
              role="group"
              aria-label="Filtrar notificações"
            >
              {[false, true].map((value) => (
                <button
                  key={String(value)}
                  aria-pressed={unreadOnly === value}
                  disabled={busy}
                  onClick={() => {
                    filter.current = value;
                    setUnreadOnly(value);
                    void refresh(value, true);
                  }}
                >
                  {value ? "Não lidas" : "Todas"}
                </button>
              ))}
            </div>
            <button
              className="notification-icon-button"
              aria-label="Atualizar notificações"
              disabled={loading || busy}
              onClick={() => void refresh()}
            >
              <RefreshCw
                size={16}
                className={loading ? "notification-spinning" : ""}
                aria-hidden="true"
              />
            </button>
          </div>
          {error && (
            <div className="notification-error" role="alert">
              {error}
              <button onClick={() => void refresh()}>Tentar novamente</button>
            </div>
          )}
          <div className="notification-scroll" aria-busy={loading || busy}>
            {!visibleItems.length && (
              <div className="notification-empty">
                <BellOff size={28} aria-hidden="true" />
                <strong>
                  {unreadOnly
                    ? "Tudo lido por aqui"
                    : "Nenhuma notificação ainda"}
                </strong>
                <p>
                  {unreadOnly
                    ? "As próximas novidades aparecerão aqui."
                    : "Novos contatos, visitas e retornos aos tours aparecem aqui."}
                </p>
              </div>
            )}
            <ul>
              {visibleItems.map((item) => {
                const Icon = item.kind.startsWith("VISIT_")
                  ? CalendarDays
                  : item.kind === "TOUR_RETURNED"
                    ? RotateCcw
                    : item.kind === "LEAD_ASSIGNED"
                      ? UserRound
                      : UserPlus;
                const date = new Date(item.createdAt);
                return (
                  <li
                    key={item.id}
                    className={item.readAt ? "" : "notification-unread"}
                  >
                    <span className="notification-item-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <Link
                      href={`/app/leads/${item.leadId}`}
                      prefetch={false}
                      onClick={() => {
                        if (!item.readAt) void mark(item.id);
                        setOpen(false);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <time dateTime={date.toISOString()}>
                        {date.toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </Link>
                    {!item.readAt && (
                      <button
                        className="notification-icon-button notification-read"
                        aria-label={`Marcar como lida: ${item.title}`}
                        title="Marcar como lida"
                        disabled={busy}
                        onClick={() => void mark(item.id)}
                      >
                        <Check size={16} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="notification-footer">
            <button
              disabled={busy || feed.unread === 0}
              onClick={() => void mark()}
            >
              <CheckCheck size={16} aria-hidden="true" /> Marcar todas como
              lidas
            </button>
            <Link href="/app/leads" onClick={() => setOpen(false)}>
              Ver leads <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
