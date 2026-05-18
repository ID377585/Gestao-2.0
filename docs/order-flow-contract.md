# Gestify order flow contract

This is the current operational contract while the schema still has both
`order_line_items` and `order_items`.

## Status transitions

Order status changes must go through database RPCs. Application code must not
write `orders.status` directly.

- Accept order: `accept_order(_order_id uuid)`
- Normal transition: `advance_order_status(p_order_id uuid, p_to_status order_status, p_note text)`
- Cancel: `cancel_order(p_order_id uuid, p_reason text)`
- Reopen: `reopen_order(p_order_id uuid, p_note text)`

## Item tables

`order_line_items` is the draft/request table. It is written while the order is
being created and before acceptance.

`order_items` is the operational/KDS table. It is populated by
`accept_order(_order_id uuid)` and should preserve the unit from
`order_line_items.unit_label` into `order_items.unit`.

Application code should not manually copy rows between these tables. If this
copy needs to change, change `accept_order` in the database.

## Label separation

Label separation must go through `separate_label_for_order`.

The RPC owns:

- validating tenant, order and label
- preventing duplicate/invalid label consumption
- creating stock movements
- linking labels to the order
- updating label status and balance

Application code may parse QR text into `label_code`, but must not update
`inventory_labels`, `inventory_movements` or `order_items_labels` directly for
order separation.
