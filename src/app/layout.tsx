import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "ImobView° — Uma nova perspectiva para cada imóvel",
    template: "%s | ImobView°",
  },
  description:
    "Encontre imóveis para comprar ou alugar com busca inteligente, tours 360° e contato direto com imobiliárias e corretores.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ImobView°",
    images: [
      { url: "/brand/imobview-original.png", width: 1448, height: 1086 },
    ],
  },
  twitter: { card: "summary_large_image" },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme =
    (await cookies()).get("imobview-theme")?.value === "dark"
      ? "dark"
      : "light";
  return (
    <html lang="pt-BR" className={manrope.variable} data-theme={theme}>
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
