import "server-only";
import { z } from "zod";
import { whatsappUrl } from "@/features/organizations/schema";

export function businessContact() {
  const email = z.email().safeParse(process.env.BUSINESS_EMAIL);
  return {
    name: process.env.BUSINESS_LEGAL_NAME || "",
    registration: process.env.BUSINESS_REGISTRATION || "",
    email: email.success ? email.data : "",
    whatsapp: whatsappUrl(
      process.env.BUSINESS_WHATSAPP || "",
      "Olá! Quero conhecer o ImobView e participar do beta.",
    ),
  };
}
