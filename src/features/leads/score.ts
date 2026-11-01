// Explainable interest score: every point comes from a recorded behavior so brokers can trust the ranking.
export type LeadSignals = {
  stage: string;
  // Any visit with measurement consent; without it only visits and requests are known.
  tracking: boolean;
  visits: number;
  started: boolean;
  completed: boolean;
  activeMs: number;
  revisits: number;
  contacts: number;
  shares: number;
  requests: number;
  simulations: number;
  details: number;
  lastActivityAt: Date;
};
export type InterestLevel = "HOT" | "WARM" | "COLD" | "CLOSED" | "LOST";
export const interestLabels = {
  HOT: "Quente",
  WARM: "Morno",
  COLD: "Frio",
  CLOSED: "Venda fechada",
  LOST: "Perdido",
} as const satisfies Record<InterestLevel, string>;
export const interestHints = {
  HOT: "Priorize: entre em contato hoje.",
  WARM: "Acompanhe: envie mais informações ou convide para visitar.",
  COLD: "Baixa prioridade por enquanto.",
  CLOSED: "Negócio concluído.",
  LOST: "Marcado como perdido.",
} as const satisfies Record<InterestLevel, string>;
export type LeadInterest = {
  score: number;
  level: InterestLevel;
  reasons: { label: string; points: number }[];
  measured: boolean;
};
const day = 86400000;

export function scoreLead(
  signals: LeadSignals,
  now = new Date(),
): LeadInterest {
  if (signals.stage === "WON")
    return {
      score: 100,
      level: "CLOSED",
      reasons: [],
      measured: signals.tracking,
    };
  if (signals.stage === "LOST")
    return { score: 0, level: "LOST", reasons: [], measured: signals.tracking };
  const reasons: LeadInterest["reasons"] = [];
  const add = (label: string, points: number) => {
    if (points) reasons.push({ label, points });
  };
  if (signals.requests)
    add(
      signals.requests > 1
        ? `Pediu ${signals.requests} visitas presenciais`
        : "Pediu visita presencial",
      35,
    );
  if (signals.simulations)
    add(
      signals.simulations > 1
        ? `Simulou financiamento ${signals.simulations} vezes`
        : "Simulou financiamento",
      15,
    );
  if (signals.contacts) add("Clicou para falar com a imobiliária", 15);
  if (signals.completed) add("Viu todos os ambientes do tour", 20);
  else if (signals.started) add("Começou o tour", 5);
  const minutes = signals.activeMs / 60000;
  if (minutes >= 1)
    add(
      `${Math.round(minutes)} min explorando o tour`,
      Math.min(20, Math.floor(minutes * 4)),
    );
  if (signals.visits > 1)
    add(
      `Voltou ao imóvel (${signals.visits} visitas)`,
      Math.min(15, (signals.visits - 1) * 5),
    );
  if (signals.revisits)
    add(
      `Revisitou ambientes ${signals.revisits} vez(es)`,
      Math.min(6, signals.revisits * 2),
    );
  if (signals.details)
    add(
      `Abriu ${signals.details} detalhe(s) do imóvel`,
      Math.min(6, signals.details * 2),
    );
  if (signals.shares) add("Compartilhou o imóvel", 5);
  if (["NEGOTIATION", "PROPOSAL"].includes(signals.stage))
    add("Em negociação com a equipe", 10);
  const idleDays = (now.getTime() - signals.lastActivityAt.getTime()) / day;
  if (idleDays > 30) add("Sem atividade há mais de 30 dias", -25);
  else if (idleDays > 14) add("Sem atividade há mais de 14 dias", -15);
  else if (idleDays <= 2 && reasons.length) add("Ativo nos últimos 2 dias", 5);
  const score = Math.max(
    0,
    Math.min(
      100,
      reasons.reduce((total, reason) => total + reason.points, 0),
    ),
  );
  return {
    score,
    level: score >= 60 ? "HOT" : score >= 30 ? "WARM" : "COLD",
    reasons,
    measured: signals.tracking,
  };
}
