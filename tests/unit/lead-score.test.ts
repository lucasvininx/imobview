import { it, expect } from "vitest";
import { scoreLead, type LeadSignals } from "@/features/leads/score";

const now = new Date("2026-10-20T12:00:00Z");
const base: LeadSignals = {
  stage: "NEW",
  tracking: true,
  visits: 1,
  started: false,
  completed: false,
  activeMs: 0,
  revisits: 0,
  contacts: 0,
  shares: 0,
  requests: 0,
  simulations: 0,
  details: 0,
  lastActivityAt: now,
};

it("keeps a lead that only left contact data cold", () => {
  expect(scoreLead(base, now)).toEqual({
    score: 0,
    level: "COLD",
    reasons: [],
    measured: true,
  });
});

it("ranks a returning visitor who requested a visit as hot and explains each point", () => {
  const interest = scoreLead(
    {
      ...base,
      visits: 2,
      started: true,
      completed: true,
      activeMs: 6 * 60000,
      revisits: 2,
      requests: 1,
    },
    now,
  );
  expect(interest.level).toBe("HOT");
  expect(interest.score).toBe(35 + 20 + 20 + 5 + 4 + 5);
  expect(interest.reasons.map((r) => r.label)).toEqual([
    "Pediu visita presencial",
    "Viu todos os ambientes do tour",
    "6 min explorando o tour",
    "Voltou ao imóvel (2 visitas)",
    "Revisitou ambientes 2 vez(es)",
    "Ativo nos últimos 2 dias",
  ]);
});

it("treats a completed tour without contact as warm", () => {
  expect(
    scoreLead(
      { ...base, started: true, completed: true, activeMs: 4 * 60000 },
      now,
    ).level,
  ).toBe("WARM");
});

it("counts returns even without measurement consent and flags the missing data", () => {
  const interest = scoreLead({ ...base, tracking: false, visits: 4 }, now);
  expect(interest).toMatchObject({ score: 20, measured: false });
  expect(interest.reasons[0]).toEqual({
    label: "Voltou ao imóvel (4 visitas)",
    points: 15,
  });
});

it("decays inactive leads and never goes below zero", () => {
  const old = new Date(now.getTime() - 40 * 86400000);
  const interest = scoreLead(
    { ...base, started: true, completed: true, lastActivityAt: old },
    now,
  );
  expect(interest.score).toBe(0);
  expect(interest.reasons.at(-1)).toEqual({
    label: "Sem atividade há mais de 30 dias",
    points: -25,
  });
});

it("caps the score and respects closed commercial stages", () => {
  expect(
    scoreLead(
      {
        ...base,
        stage: "PROPOSAL",
        visits: 5,
        started: true,
        completed: true,
        activeMs: 60 * 60000,
        revisits: 20,
        contacts: 3,
        shares: 2,
        requests: 3,
      },
      now,
    ).score,
  ).toBe(100);
  expect(scoreLead({ ...base, stage: "WON" }, now).level).toBe("CLOSED");
  expect(scoreLead({ ...base, stage: "LOST", requests: 1 }, now)).toEqual({
    score: 0,
    level: "LOST",
    reasons: [],
    measured: true,
  });
});

it("treats a financing simulation as a strong buying signal", () => {
  const interest = scoreLead(
    { ...base, started: true, completed: true, simulations: 2 },
    now,
  );
  expect(interest.reasons[0]).toEqual({
    label: "Simulou financiamento 2 vezes",
    points: 15,
  });
  expect(interest.level).toBe("WARM");
});

it("counts opened room details with a small capped bonus", () => {
  expect(scoreLead({ ...base, details: 5 }, now).reasons[0]).toEqual({
    label: "Abriu 5 detalhe(s) do imóvel",
    points: 6,
  });
});
