import type { Metadata } from "next";

import { PublicHomePage } from "@/components/site/public-pages";

export const metadata: Metadata = {
  title: "Gestify - Gestao inteligente para restaurantes",
  description:
    "Plataforma SaaS para restaurantes com estoque, compras, fichas tecnicas, producao, etiquetas, perdas, financeiro e indicadores.",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return <PublicHomePage />;
}
