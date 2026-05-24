# P0 RPC service role patch

Antes de aplicar `supabase/migrations/20260524134000_secure_service_role_rpc.sql`, as chamadas do app precisam ser movidas para server-side admin client.

## Arquivos

- `src/app/api/inventory-labels/route.ts`
- `src/app/(dashboard)/dashboard/etiquetas/actions.ts`
- `src/app/(dashboard)/dashboard/pedidos/actions.ts`

## Mudanca esperada

1. Validar usuario e tenant com o fluxo atual.
2. Obter o user id autenticado no servidor.
3. Chamar as RPCs sensiveis usando `getSupabaseAdminClient()`.
4. Enviar `p_user_id` na chamada.

## Chamadas afetadas

- `create_inventory_label`
- `create_order_with_items`

## Ordem segura

1. Alterar codigo do app.
2. Fazer build.
3. Testar criacao de pedido e etiqueta.
4. Aplicar migration P0.
5. Rodar Supabase Security Advisor.
