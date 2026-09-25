import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
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
    "Transforme a apresentação dos seus imóveis. Páginas compartilháveis e uma nova perspectiva para imobiliárias e corretores.",
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
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
