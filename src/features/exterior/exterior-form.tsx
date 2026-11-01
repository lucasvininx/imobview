"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { saveExteriorAction } from "./actions";
import {
  amenities,
  amenityLabels,
  facadeLabels,
  facades,
  parseCoordinates,
  utcOffsets,
  type ExteriorConfig,
} from "./schema";

const offsetLabels: Record<number, string> = {
  [-2]: "Fernando de Noronha (UTC−2)",
  [-3]: "Brasília (UTC−3)",
  [-4]: "Amazonas, MT, MS, RO, RR (UTC−4)",
  [-5]: "Acre (UTC−5)",
};
const facadeHints = {
  N: "mais sol no inverno",
  E: "sol da manhã",
  S: "menos sol direto",
  W: "sol da tarde",
} as const;

export function ExteriorForm({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: ExteriorConfig | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const value = initial ?? {
    enabled: false,
    buildingName: "",
    latitude: 0,
    longitude: 0,
    utcOffset: -3,
    towers: 1,
    floors: 10,
    unitTower: 1,
    unitFloor: 5,
    unitFacade: "N" as const,
    amenities: [],
  };
  return (
    <form
      className="form-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const place = parseCoordinates(String(data.get("coordinates") ?? ""));
        if (!place) {
          setOk(false);
          setMessage(
            "Informe as coordenadas como no Google Maps, por exemplo -23.5613, -46.6565.",
          );
          return;
        }
        setBusy(true);
        setMessage("");
        try {
          const result = await saveExteriorAction(propertyId, {
            enabled: data.get("enabled") === "on",
            buildingName: data.get("buildingName"),
            ...place,
            utcOffset: Number(data.get("utcOffset")),
            towers: Number(data.get("towers")),
            floors: Number(data.get("floors")),
            unitTower: Number(data.get("unitTower")),
            unitFloor: Number(data.get("unitFloor")),
            unitFacade: data.get("unitFacade"),
            amenities: data.getAll("amenities"),
          });
          setOk(result.success);
          setMessage(
            result.success
              ? "Vista 3D atualizada. Confira na página pública."
              : result.error,
          );
        } catch {
          setOk(false);
          setMessage("Não foi possível conectar. Tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Vista 3D externa e sol</h2>
      <p>
        Gera uma maquete do condomínio para o visitante girar em volta como um
        drone e ver onde bate o sol em cada horário. Não é preciso ter um modelo
        3D: basta descrever o prédio.
      </p>
      <label className="check-field">
        <input type="checkbox" name="enabled" defaultChecked={value.enabled} />
        Mostrar a vista 3D na página do imóvel
      </label>
      <div className="form-grid">
        <label className="field">
          Nome do empreendimento
          <input
            name="buildingName"
            maxLength={80}
            defaultValue={value.buildingName}
            placeholder="Ex.: Residencial Jardim das Flores"
          />
        </label>
        <label className="field">
          Coordenadas do prédio
          <input
            name="coordinates"
            required
            defaultValue={
              initial ? `${value.latitude}, ${value.longitude}` : ""
            }
            placeholder="-23.5613, -46.6565"
          />
          <small>
            No Google Maps, clique com o botão direito no prédio e copie os
            números. Usadas só para calcular o sol; a página mostra apenas uma
            localização aproximada.
          </small>
        </label>
        <label className="field">
          Fuso horário
          <select name="utcOffset" defaultValue={value.utcOffset}>
            {utcOffsets.map((offset) => (
              <option key={offset} value={offset}>
                {offsetLabels[offset]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Torres no condomínio
          <input
            name="towers"
            type="number"
            min={1}
            max={4}
            required
            defaultValue={value.towers}
          />
        </label>
        <label className="field">
          Andares por torre
          <input
            name="floors"
            type="number"
            min={2}
            max={60}
            required
            defaultValue={value.floors}
          />
        </label>
        <label className="field">
          Torre do apartamento
          <input
            name="unitTower"
            type="number"
            min={1}
            max={4}
            required
            defaultValue={value.unitTower}
          />
        </label>
        <label className="field">
          Andar do apartamento
          <input
            name="unitFloor"
            type="number"
            min={1}
            max={60}
            required
            defaultValue={value.unitFloor}
          />
        </label>
        <label className="field">
          Para onde as janelas da sala estão voltadas
          <select name="unitFacade" defaultValue={value.unitFacade}>
            {facades.map((facade) => (
              <option key={facade} value={facade}>
                {facadeLabels[facade]} ({facadeHints[facade]})
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="exterior-amenities">
        <legend>Lazer do condomínio</legend>
        {amenities.map((item) => (
          <label key={item} className="check-field">
            <input
              type="checkbox"
              name="amenities"
              value={item}
              defaultChecked={value.amenities.includes(item)}
            />
            {amenityLabels[item]}
          </label>
        ))}
      </fieldset>
      {message && (
        <p
          role={ok ? "status" : "alert"}
          className={ok ? "form-success" : "form-error"}
        >
          {message}
        </p>
      )}
      <Button disabled={busy}>{busy ? "Salvando…" : "Salvar vista 3D"}</Button>
    </form>
  );
}
