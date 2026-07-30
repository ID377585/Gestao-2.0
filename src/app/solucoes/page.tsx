import type { Metadata } from "next";

import { SolucoesPageContent } from "@/components/site/public-pages";

export const metadata: Metadata = {
  title: "Solucoes - Gestify",
  description:
    "Solucoes do Gestify para restaurantes, bares, confeitarias e cozinhas centrais que precisam de controle operacional.",
  alternates: {
    canonical: "/solucoes",
  },
};

export default function SolucoesPage() {
  return <SolucoesPageContent />;
}
