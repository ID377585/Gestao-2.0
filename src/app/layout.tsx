import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { CookieBanner } from "@/components/legal/CookieBanner";
import { SITE_URL } from "@/lib/legal-content";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Gestify - Sistema de Gestão para Restaurantes",
  description:
    "Plataforma de gestão para restaurantes com controle de pedidos, produção, estoque, etiquetas, produtividade e operação.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Gestify - Sistema de Gestão para Restaurantes",
    description:
      "Plataforma de gestão para restaurantes com controle de pedidos, produção, estoque, etiquetas, produtividade e operação.",
    url: SITE_URL,
    siteName: "Gestify",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
            {children}
            <CookieBanner />
          </div>
        </Providers>
      </body>
    </html>
  );
}
