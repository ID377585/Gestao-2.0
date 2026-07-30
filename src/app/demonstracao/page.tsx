import type { Metadata } from "next";

import { DemoRequestForm } from "@/components/site/DemoRequestForm";
import {
  DemoSupportBlock,
  PublicHero,
  PublicPageShell,
} from "@/components/site/public-pages";

export const metadata: Metadata = {
  title: "Demonstracao - Gestify",
  description:
    "Solicite uma demonstracao do Gestify e veja como organizar estoque, compras, fichas tecnicas, producao, etiquetas e indicadores.",
  alternates: {
    canonical: "/demonstracao",
  },
};

export default function DemonstracaoPage() {
  return (
    <PublicPageShell>
      <PublicHero
        eyebrow="Demonstracao"
        title="Veja como o Gestify pode organizar sua operacao"
        description="Conte um pouco sobre seu restaurante ou operacao. Vamos entender seu momento e indicar a melhor forma de usar o Gestify."
      />
      <section className="bg-[#F7F8FA]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <DemoSupportBlock />
          <DemoRequestForm
            whatsappUrl={process.env.NEXT_PUBLIC_WHATSAPP_URL ?? null}
          />
        </div>
      </section>
    </PublicPageShell>
  );
}
