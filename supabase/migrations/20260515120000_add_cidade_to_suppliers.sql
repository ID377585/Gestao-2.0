-- Add missing city field used by the supplier registration and edit screens.
alter table public.suppliers
add column if not exists cidade text;
