import type { Metadata } from "next";

import { RecursosPageContent } from "@/components/site/public-pages";

export const metadata: Metadata = {
  title: "Recursos - Gestify",
  description:
    "Conheca os recursos do Gestify para estoque, compras, fichas tecnicas, producao, etiquetas, inventario, financeiro e permissoes.",
  alternates: {
    canonical: "/recursos",
  },
};

export default function RecursosPage() {
  return <RecursosPageContent />;
}
