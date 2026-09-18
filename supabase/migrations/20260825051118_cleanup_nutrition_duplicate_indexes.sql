-- Remove only duplicate indexes that do not back constraints.
-- The constraint-backed indexes without the _idx suffix must remain intact.

begin;

drop index if exists public.nutrition_document_versions_unique_idx;
drop index if exists public.nutrition_pop_versions_unique_idx;

commit;
