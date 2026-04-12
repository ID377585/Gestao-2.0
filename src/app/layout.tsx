import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestify - Sistema de Gestão para Restaurantes",
  description:
    "Plataforma de gestão para restaurantes com controle de pedidos, produção, estoque, etiquetas, produtividade e operação.",
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
          </div>
        </Providers>
      </body>
    </html>
  );
}