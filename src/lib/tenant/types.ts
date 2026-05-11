export type TenantMembershipRole =
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "admin"
  | "entrega";

export type TenantMembership = {
  id: string;
  user_id: string;
  role: TenantMembershipRole;
  org_id: string | null;
  unit_id: string | null;
  establishment_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type TenantContext = {
  userId: string;
  email: string | null;
  membership: TenantMembership;
  role: TenantMembershipRole;
  orgId: string | null;
  unitId: string | null;
  establishmentId: string;
};
