import type { Metadata } from "next";

import { ConteudosPageContent } from "@/components/site/public-pages";

export const metadata: Metadata = {
  title: "Conteudos - Gestify",
  description:
    "Conteudos sobre estoque, CMV, fichas tecnicas, compras, perdas, inventario e gestao gastronomica.",
  alternates: {
    canonical: "/conteudos",
  },
};

export default function ConteudosPage() {
  return <ConteudosPageContent />;
}
