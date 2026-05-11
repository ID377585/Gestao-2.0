export type BillingPlan = {
  slug: string;
  name: string;
  description: string;
  monthlyPriceInCents: number;
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
    description: "Plano inicial para pequenas operações.",
    monthlyPriceInCents: 9900,
    limits: {
      users: 5,
      establishments: 1,
      products: 500,
    },
  },
  {
    slug: "growth",
    name: "Growth",
    description: "Plano para operações em crescimento.",
    monthlyPriceInCents: 19900,
    limits: {
      users: 20,
      establishments: 3,
      products: 5000,
    },
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Plano personalizado para redes e operações maiores.",
    monthlyPriceInCents: 0,
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
