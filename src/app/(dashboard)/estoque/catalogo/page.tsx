import { CatalogoClient, type CatalogItem } from "./CatalogoClient";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenantOrRedirect } from "@/lib/tenant/guards";
import { assertTenantCanAccessModule } from "@/lib/tenant/module-access";

export const dynamic = "force-dynamic";

export default async function CatalogoEstoquePage() {
  const tenant = await getActiveTenantOrRedirect();
  await assertTenantCanAccessModule(tenant, "estoque");

  const supabase = await createSupabaseServerClient();
  const [{ data: items, error: itemsError }, { data: establishment }] =
    await Promise.all([
      supabase
        .from("inventory_catalog_items")
        .select(
          "id, name, brand, model, category, quantity, unit_label, item_condition, location, description, photo_path, photo_file_name, photo_mime_type, photo_size_bytes, created_at, updated_at"
        )
        .eq("establishment_id", tenant.establishmentId)
        .order("name", { ascending: true }),
      supabase
        .from("establishments")
        .select("name")
        .eq("id", tenant.establishmentId)
        .maybeSingle(),
    ]);

  if (itemsError) {
    console.error("[inventory-catalog] initial load failed:", itemsError);
  }

  return (
    <CatalogoClient
      establishmentName={String(establishment?.name ?? "Empresa ativa")}
      generatedAt={new Date().toISOString()}
      initialItems={(items ?? []) as CatalogItem[]}
      initialLoadError={
        itemsError
          ? "Não foi possível carregar os itens do catálogo. Recarregue a página."
          : null
      }
    />
  );
}
