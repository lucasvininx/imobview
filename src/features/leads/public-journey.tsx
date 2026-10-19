"use client";
import { useState } from "react";
import Link from "next/link";
import { TourViewer } from "@/features/tours/viewer";
import type { TourSceneView } from "@/features/tours/viewer-types";
import { Button } from "@/components/ui";
import { beginVisitAction, requestVisitAction } from "./public-actions";
import { sourceFromLocation } from "./schema";
import { useJourney } from "./use-journey";
export function PublicJourney({
  slug,
  tour,
  capture,
}: {
  slug: string;
  capture: boolean;
  tour: { id: string; initialSceneId: string | null; scenes: TourSceneView[] };
}) {
  const [gate, setGate] = useState(capture),
    [form, setForm] = useState(capture),
    [token, setToken] = useState<string | null>(null);
  const [identified, setIdentified] = useState(false),
    [tracking, setTracking] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [requested, setRequested] = useState(false);
  const journey = useJourney(token, tracking, tour.scenes.length);
  async function begin(data: FormData | null) {
    setBusy(true);
    setError("");
    try {
      const measure = data ? data.get("tracking") === "on" : true;
      const result = await beginVisitAction({
        slug,
        tourId: tour.id,
        tracking: measure,
        source: sourceFromLocation(location.search, document.referrer),
        website: data?.get("website") ?? "",
        ...(data
          ? {
              contact: {
                name: data.get("name"),
                email: data.get("email"),
                phone: data.get("phone"),
                consent: data.get("consent") === "on",
              },
            }
          : {}),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      journey.stop();
      setToken(result.token);
      setTracking(measure);
      setIdentified(!!data);
      setGate(false);
      setForm(false);
    } catch {
      setError(
        "Conexão indisponível. Tente novamente ou continue sem informar dados.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="journey">
      {form && (
        <form
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            void begin(new FormData(e.currentTarget));
          }}
        >
          <h3>Conheça o imóvel. Converse com quem pode ajudar.</h3>
          <p>
            Deixe seu contato para a imobiliária responsável responder sobre
            este imóvel. Você também pode visitar sem se identificar.
          </p>
          <div className="form-grid">
            <label className="field">
              Nome e sobrenome
              <input
                name="name"
                required
                minLength={3}
                maxLength={160}
                autoComplete="name"
              />
            </label>
            <label className="field">
              E-mail
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label className="field">
              Telefone / WhatsApp
              <input
                name="phone"
                type="tel"
                required
                minLength={10}
                maxLength={25}
                autoComplete="tel"
              />
            </label>
          </div>
          <label hidden aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="check-field">
            <input type="checkbox" name="consent" required />
            Quero receber contato da imobiliária sobre este imóvel e li o{" "}
            <Link href="/privacidade" target="_blank">
              aviso de privacidade
            </Link>
            .
          </label>
          <label className="check-field">
            <input type="checkbox" name="tracking" />
            Permito registrar ambientes visitados, tempo ativo e cliques para
            ajudar a imobiliária a entender meu interesse. Opcional.
          </label>
          <div className="form-actions">
            <Button disabled={busy}>
              {busy ? "Registrando…" : "Identificar e continuar"}
            </Button>
            <Button
              type="button"
              variant="quiet"
              disabled={busy}
              onClick={() => {
                setGate(false);
                setForm(false);
                setError("");
              }}
            >
              Continuar sem informar dados
            </Button>
          </div>
        </form>
      )}
      {!gate && (
        <TourViewer
          key={token ?? "anonymous"}
          scenes={tour.scenes}
          initialSceneId={tour.initialSceneId}
          onSceneChange={journey.sceneChanged}
          onHotspot={journey.hotspot}
        />
      )}
      {!form && (
        <div className="journey-controls">
          {!identified && (
            <Button variant="secondary" onClick={() => setForm(true)}>
              Solicitar contato ou visita
            </Button>
          )}
          {!tracking ? (
            !identified && (
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => void begin(null)}
              >
                Permitir medição da visita
              </Button>
            )
          ) : (
            <Button
              variant="quiet"
              onClick={() => {
                journey.stop();
                setTracking(false);
              }}
            >
              Parar medição
            </Button>
          )}
          <p className="muted">
            {tracking
              ? "Medição ativa: ambientes, tempo com a página visível e cliques. Conclusão significa que todos os ambientes foram abertos."
              : "Navegação sem medição. Seus dados só serão enviados se você escolher compartilhar."}
          </p>
        </div>
      )}
      {identified && (
        <form
          className="form-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const result = await requestVisitAction(
                token,
                Object.fromEntries(data),
              );
              if (result.success) setRequested(true);
              else setError(result.error);
            } catch {
              setError("Falha de conexão. Tente novamente.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Gostou do imóvel? Solicite uma visita presencial.</h3>
          <p>
            A imobiliária entrará em contato para combinar o horário. A
            solicitação não reserva uma vaga na agenda.
          </p>
          <div className="form-grid">
            <label className="field">
              Data de preferência
              <input name="preferredDate" type="date" required />
            </label>
            <label className="field">
              Período
              <select name="period">
                <option value="MORNING">Manhã</option>
                <option value="AFTERNOON">Tarde</option>
                <option value="EVENING">Noite</option>
              </select>
            </label>
          </div>
          <Button disabled={busy || requested}>
            {requested ? "Solicitação recebida" : "Solicitar visita"}
          </Button>
          {requested && (
            <p role="status">
              Sua solicitação foi registrada. Aguarde a confirmação da
              imobiliária.
            </p>
          )}
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
