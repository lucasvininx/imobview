export const integrationProviders = [
  {
    slug: "google",
    provider: "GOOGLE",
    title: "Google Agenda",
    description: "Mantenha visitas, horários e reagendamentos na sua agenda.",
    channels: ["CALENDAR"],
  },
  {
    slug: "whatsapp",
    provider: "WHATSAPP",
    title: "WhatsApp Business",
    description: "Avise os corretores sobre cada atualização das visitas.",
    channels: ["WHATSAPP"],
  },
  {
    slug: "email",
    provider: "EMAIL",
    title: "E-mail com Resend",
    description: "Envie confirmações aos clientes e avisos à sua equipe.",
    channels: ["EMAIL_TEAM", "EMAIL_CLIENT"],
  },
] as const;
export type IntegrationSlug = (typeof integrationProviders)[number]["slug"];
