import type { Metadata } from "next";

import { SobrePageContent } from "@/components/site/public-pages";

export const metadata: Metadata = {
  title: "Sobre - Gestify",
  description:
    "Conheca a origem do Gestify, uma plataforma criada a partir da rotina real de operacoes gastronomicas.",
  alternates: {
    canonical: "/sobre",
  },
};

export default function SobrePage() {
  return <SobrePageContent />;
}
