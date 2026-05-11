export type BillingPlan = {
  slug: string;
  name: string;
  description: string;
  monthlyPriceInCents: number | null;
  limits: {
    users: number | null;
    establishments: number | null;
    products: number | null;
  };
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    slug: "starter",
    name: "Starter",
    description:
      "Plano para pequena operação, cozinha, confeitaria ou restaurante pequeno.",
    monthlyPriceInCents: 3990,
    limits: {
      users: 5,
      establishments: 1,
      products: 500,
    },
  },
  {
    slug: "growth",
    name: "Growth",
    description:
      "Plano para operação maior, empresa com mais setores ou pequena rede.",
    monthlyPriceInCents: 9990,
    limits: {
      users: 20,
      establishments: 3,
      products: 5000,
    },
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description:
      "Plano personalizado para redes, operação premium ou implantação sob medida.",
    monthlyPriceInCents: null,
    limits: {
      users: null,
      establishments: null,
      products: null,
    },
  },
];

export function getBillingPlan(slug: string | null | undefined) {
  if (!slug) return null;
  return BILLING_PLANS.find((plan) => plan.slug === slug) ?? null;
}

export function formatBillingPrice(plan: BillingPlan | null) {
  if (!plan) return "Plano não configurado";
  if (plan.monthlyPriceInCents === null) return "Personalizado";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(plan.monthlyPriceInCents / 100);
}
