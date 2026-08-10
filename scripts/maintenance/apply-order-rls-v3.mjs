#!/usr/bin/env node

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function replaceOnce(content, before, after, label) {
  const first = content.indexOf(before);
  if (first < 0) {
    throw new Error(`[order-rls-v3] Padrao ausente: ${label}`);
  }
  if (content.indexOf(before, first + before.length) >= 0) {
    throw new Error(`[order-rls-v3] Padrao duplicado: ${label}`);
  }
  return content.slice(0, first) + after + content.slice(first + before.length);
}

function updateFile(relativePath, transform) {
  const path = resolve(ROOT, relativePath);
  const current = readFileSync(path, "utf8");
  const next = transform(current);
  if (next === current) {
    throw new Error(`[order-rls-v3] Nenhuma alteracao em ${relativePath}`);
  }
  writeFileSync(path, next, "utf8");
}

updateFile(
  "src/app/(dashboard)/dashboard/pedidos/actions.ts",
  (source) => {
    let next = source;

    next = replaceOnce(
      next,
      `/**\n * ✅ Cancelar pedido\n * Agora: chama RPC cancel_order (status + timeline)\n * Depois: atualiza canceled_by/canceled_at/cancel_reason (sem mudar status)\n */`,
      `/**\n * ✅ Cancelar pedido\n * A RPC canonica grava status, metadados e timeline na mesma transacao.\n * O fallback server-side existe apenas enquanto o banco conectado usa a RPC legada.\n */`,
      "comentario cancelOrder"
    );

    next = replaceOnce(
      next,
      `      const { error: metaErr } = await supabase\n        .from("orders")\n        .update({\n          canceled_by: userData.user.id,\n          canceled_at: new Date().toISOString(),\n          cancel_reason: trimmed,\n        })\n        .eq("id", orderId)\n        .eq("establishment_id", establishmentId);\n\n      if (metaErr) throw new Error(metaErr.message);`,
      `      const { data: persistedOrder, error: persistedErr } = await supabase\n        .from("orders")\n        .select("canceled_by, canceled_at, cancel_reason")\n        .eq("id", orderId)\n        .eq("establishment_id", establishmentId)\n        .maybeSingle();\n\n      if (persistedErr || !persistedOrder) {\n        throw new Error(\n          persistedErr?.message ?? "Pedido nao encontrado apos cancelamento."\n        );\n      }\n\n      const rpcPersistedMetadata =\n        persistedOrder.canceled_by === userData.user.id &&\n        persistedOrder.canceled_at !== null &&\n        persistedOrder.canceled_at !== order.canceled_at &&\n        persistedOrder.cancel_reason === trimmed;\n\n      if (!rpcPersistedMetadata) {\n        const supabaseAdmin = createSupabaseAdminClient();\n        const { data: legacyUpdatedOrder, error: legacyUpdateErr } =\n          await supabaseAdmin\n            .from("orders")\n            .update({\n              canceled_by: userData.user.id,\n              canceled_at: new Date().toISOString(),\n              cancel_reason: trimmed,\n            })\n            .eq("id", orderId)\n            .eq("establishment_id", establishmentId)\n            .select("id")\n            .maybeSingle();\n\n        if (legacyUpdateErr || !legacyUpdatedOrder) {\n          throw new Error(\n            legacyUpdateErr?.message ??\n              "Falha ao persistir metadados do cancelamento."\n          );\n        }\n\n        console.warn(\n          "[orders.cancel] Fallback legado de metadados executado; aplique o cutover RLS v3 no staging."\n        );\n      }`,
      "fallback cancelOrder"
    );

    next = replaceOnce(
      next,
      `/**\n * ✅ Reabrir pedido (cancelado -> aceitou_pedido)\n * Agora: chama RPC reopen_order (status + timeline)\n * Depois: atualiza reopened_by/reopened_at (sem mudar status)\n *\n * OBS: no banco deixamos "só admin". Aqui também deixo só admin pra UX.\n */`,
      `/**\n * ✅ Reabrir pedido (cancelado -> aceitou_pedido)\n * A RPC canonica grava status, metadados e timeline na mesma transacao.\n * O fallback server-side existe apenas enquanto o banco conectado usa a RPC legada.\n *\n * OBS: no banco deixamos "so admin". Aqui tambem deixo so admin pra UX.\n */`,
      "comentario reopenOrder"
    );

    next = replaceOnce(
      next,
      `      const { error: metaErr } = await supabase\n        .from("orders")\n        .update({\n          reopened_by: userData.user.id,\n          reopened_at: new Date().toISOString(),\n        })\n        .eq("id", orderId)\n        .eq("establishment_id", establishmentId);\n\n      if (metaErr) throw new Error(metaErr.message);`,
      `      const { data: persistedOrder, error: persistedErr } = await supabase\n        .from("orders")\n        .select("reopened_by, reopened_at")\n        .eq("id", orderId)\n        .eq("establishment_id", establishmentId)\n        .maybeSingle();\n\n      if (persistedErr || !persistedOrder) {\n        throw new Error(\n          persistedErr?.message ?? "Pedido nao encontrado apos reabertura."\n        );\n      }\n\n      const rpcPersistedMetadata =\n        persistedOrder.reopened_by === userData.user.id &&\n        persistedOrder.reopened_at !== null &&\n        persistedOrder.reopened_at !== order.reopened_at;\n\n      if (!rpcPersistedMetadata) {\n        const supabaseAdmin = createSupabaseAdminClient();\n        const { data: legacyUpdatedOrder, error: legacyUpdateErr } =\n          await supabaseAdmin\n            .from("orders")\n            .update({\n              reopened_by: userData.user.id,\n              reopened_at: new Date().toISOString(),\n            })\n            .eq("id", orderId)\n            .eq("establishment_id", establishmentId)\n            .select("id")\n            .maybeSingle();\n\n        if (legacyUpdateErr || !legacyUpdatedOrder) {\n          throw new Error(\n            legacyUpdateErr?.message ??\n              "Falha ao persistir metadados da reabertura."\n          );\n        }\n\n        console.warn(\n          "[orders.reopen] Fallback legado de metadados executado; aplique o cutover RLS v3 no staging."\n        );\n      }`,
      "fallback reopenOrder"
    );

    return next;
  }
);

updateFile(
  "supabase/migrations/20260803213227_consolidate_order_rls_p0.sql",
  (source) => {
    let next = source;

    next = replaceOnce(
      next,
      `create or replace function private.gestify_order_can_update_metadata(\n  p_establishment_id uuid\n)\nreturns boolean\nlanguage sql\nstable\nsecurity definer\nset search_path = pg_catalog, public, auth, pg_temp\nas $$\n  select coalesce(\n    private.gestify_order_role_for_scope(p_establishment_id) in (\n      'admin',\n      'operacao'\n    ),\n    false\n  )\n$$;\n\n`,
      "",
      "helper de update de metadados"
    );

    next = replaceOnce(
      next,
      `revoke all on function private.gestify_order_can_update_metadata(uuid)\n  from public, anon, authenticated;\n`,
      "",
      "revoke helper de update"
    );

    next = replaceOnce(
      next,
      `grant execute on function private.gestify_order_can_update_metadata(uuid)\n  to authenticated, service_role;\n`,
      "",
      "grant helper de update"
    );

    next = replaceOnce(
      next,
      `create or replace function public.gestify_validate_order_metadata_update()\nreturns trigger\nlanguage plpgsql\nset search_path = pg_catalog, public, private, auth, pg_temp\nas $$\ndeclare\n  v_uid uuid := (select auth.uid());\n  v_role text;\nbegin\n  if current_user in ('postgres', 'supabase_admin', 'service_role') then\n    return new;\n  end if;\n\n  v_role := private.gestify_order_role_for_scope(old.establishment_id);\n\n  if new.canceled_by is distinct from old.canceled_by\n    or new.canceled_at is distinct from old.canceled_at\n    or new.cancel_reason is distinct from old.cancel_reason\n  then\n    if coalesce(v_role, '') not in ('admin', 'operacao')\n      or new.status <> 'cancelado'::public.order_status\n      or new.canceled_by is distinct from v_uid\n      or new.canceled_at is null\n      or nullif(btrim(coalesce(new.cancel_reason, '')), '') is null\n    then\n      raise exception 'Metadados de cancelamento inválidos'\n        using errcode = '42501';\n    end if;\n  end if;\n\n  if new.reopened_by is distinct from old.reopened_by\n    or new.reopened_at is distinct from old.reopened_at\n  then\n    if v_role <> 'admin'\n      or new.status <> 'aceitou_pedido'::public.order_status\n      or new.reopened_by is distinct from v_uid\n      or new.reopened_at is null\n    then\n      raise exception 'Metadados de reabertura inválidos'\n        using errcode = '42501';\n    end if;\n  end if;\n\n  return new;\nend;\n$$;\n\n`,
      "",
      "funcao de validacao de update"
    );

    next = replaceOnce(
      next,
      `revoke all on function public.gestify_validate_order_metadata_update()\n  from public, anon, authenticated;\n`,
      "",
      "revoke da validacao de update"
    );

    next = replaceOnce(
      next,
      `drop trigger if exists gestify_validate_order_metadata_update on public.orders;\ncreate trigger gestify_validate_order_metadata_update\n  before update of canceled_by, canceled_at, cancel_reason, reopened_by, reopened_at\n  on public.orders\n  for each row\n  execute function public.gestify_validate_order_metadata_update();`,
      `drop trigger if exists gestify_validate_order_metadata_update on public.orders;\ndrop function if exists public.gestify_validate_order_metadata_update();`,
      "trigger de compatibilidade"
    );

    next = replaceOnce(
      next,
      `-- Temporary bridge for the existing server actions after the cancellation and\n-- reopen RPC already committed their metadata. Identity and lifecycle status\n-- columns are not directly updatable by authenticated users.\ncreate policy orders_update_metadata_canonical\n  on public.orders\n  for update\n  to authenticated\n  using (\n    private.gestify_order_can_update_metadata(establishment_id)\n  )\n  with check (\n    private.gestify_order_can_update_metadata(establishment_id)\n  );\n\n`,
      `-- Authenticated sessions are intentionally read-only on public.orders.\n-- Every lifecycle mutation must pass through a reviewed RPC.\n\n`,
      "policy de update de metadados"
    );

    next = replaceOnce(
      next,
      `grant update (\n  canceled_by,\n  canceled_at,\n  cancel_reason,\n  reopened_by,\n  reopened_at\n) on public.orders to authenticated;\n\n`,
      "",
      "grant de update por coluna"
    );

    next = replaceOnce(
      next,
      `        'gestify_order_can_update_metadata',\n`,
      "",
      "helper na auditoria"
    );

    next = replaceOnce(
      next,
      `'version', 'gestify-order-rls-v2',`,
      `'version', 'gestify-order-rls-v3',`,
      "versao da auditoria"
    );

    return next;
  }
);

updateFile(
  "scripts/rls/verify-order-cutover.sql",
  (source) => {
    let next = source;

    next = replaceOnce(
      next,
      `create or replace function private.test_repeat_cancel_metadata_allowed(p_order_id uuid)\nreturns boolean\nlanguage plpgsql\nset search_path = pg_catalog, public, private, auth, pg_temp\nas $$\ndeclare\n  v_rows integer;\nbegin\n  update public.orders\n  set\n    canceled_by = (select auth.uid()),\n    canceled_at = now(),\n    cancel_reason = 'cancelamento confirmado pelo server action'\n  where id = p_order_id;\n  get diagnostics v_rows = row_count;\n  return v_rows = 1;\nend;\n$$;\n\n`,
      "",
      "teste de compatibilidade permitida"
    );

    next = replaceOnce(
      next,
      `grant execute on function private.test_repeat_cancel_metadata_allowed(uuid) to authenticated;\n`,
      "",
      "grant do teste permitido"
    );

    next = replaceOnce(
      next,
      `  (select count(*) = 2 from pg_catalog.pg_policies\n   where schemaname = 'public' and tablename = 'orders'),\n  'orders must have exactly SELECT and metadata UPDATE policies'`,
      `  (select count(*) = 1 from pg_catalog.pg_policies\n   where schemaname = 'public' and tablename = 'orders'),\n  'orders must have exactly one SELECT policy'`,
      "contagem de policies de orders"
    );

    next = replaceOnce(
      next,
      `      and cmd not in ('SELECT', 'UPDATE')\n  ),\n  'orders exposes an unexpected direct command policy'`,
      `      and cmd <> 'SELECT'\n  ),\n  'orders exposes a direct write policy'`,
      "comandos permitidos em orders"
    );

    next = replaceOnce(
      next,
      `  coalesce(\n    (\n      select array_agg(privilege.column_name::text order by privilege.column_name)\n      from information_schema.column_privileges privilege\n      where privilege.table_schema = 'public'\n        and privilege.table_name = 'orders'\n        and privilege.grantee = 'authenticated'\n        and privilege.privilege_type = 'UPDATE'\n    ),\n    array[]::text[]\n  ) = array[\n    'cancel_reason',\n    'canceled_at',\n    'canceled_by',\n    'reopened_at',\n    'reopened_by'\n  ]::text[],\n  'orders authenticated UPDATE columns differ from the compatibility bridge'`,
      `  not exists (\n    select 1\n    from information_schema.column_privileges privilege\n    where privilege.table_schema = 'public'\n      and privilege.table_name = 'orders'\n      and privilege.grantee = 'authenticated'\n      and privilege.privilege_type = 'UPDATE'\n  ),\n  'authenticated still has order UPDATE column privileges'`,
      "privilegios de update por coluna"
    );

    next = replaceOnce(
      next,
      `select private.test_assert(\n  private.test_repeat_cancel_metadata_allowed('a1111111-1111-4111-8111-111111111111'),\n  'current server-action cancellation metadata compatibility update failed'\n);`,
      `select private.test_assert(\n  private.test_invalid_cancel_metadata_denied('a1111111-1111-4111-8111-111111111111'),\n  'direct cancellation metadata update remained available after the RPC'\n);`,
      "assert de update apos cancelamento"
    );

    next = replaceOnce(
      next,
      `(public.gestify_order_rls_audit() ->> 'version') = 'gestify-order-rls-v2',`,
      `(public.gestify_order_rls_audit() ->> 'version') = 'gestify-order-rls-v3',`,
      "versao esperada no drill"
    );

    const triggerAnchor = `select private.test_assert(\n  (select count(*) = 1\n   from pg_catalog.pg_trigger trigger\n   join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid\n   join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace\n   where trigger.tgisinternal = false\n     and namespace.nspname = 'public'\n     and relation.relname = 'orders'\n     and trigger.tgname = 'gestify_require_order_status_flow'),\n  'direct status guard is missing'\n);`;

    next = replaceOnce(
      next,
      triggerAnchor,
      `${triggerAnchor}\n\nselect private.test_assert(\n  not exists (\n    select 1\n    from pg_catalog.pg_trigger trigger\n    join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid\n    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace\n    where trigger.tgisinternal = false\n      and namespace.nspname = 'public'\n      and relation.relname = 'orders'\n      and trigger.tgname = 'gestify_validate_order_metadata_update'\n  ),\n  'legacy metadata update trigger remains installed'\n);`,
      "assert de ausencia do trigger legado"
    );

    return next;
  }
);

for (const temporaryPath of [
  "scripts/maintenance/apply-order-rls-v3.mjs",
  ".github/workflows/apply-order-rls-v3.yml",
]) {
  try {
    unlinkSync(resolve(ROOT, temporaryPath));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log("[order-rls-v3] Patch aplicado e arquivos temporarios removidos.");
