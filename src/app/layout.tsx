import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestão 2.0 - Sistema de Gestão para Restaurantes",
  description:
    "Sistema completo de gestão para restaurantes com controle de pedidos, produção, estoque e produtividade",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-50">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
