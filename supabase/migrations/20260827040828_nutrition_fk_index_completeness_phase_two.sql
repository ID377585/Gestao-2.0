-- Cover every currently-unindexed FK in public.nutrition_* tables.
-- Dynamic generation keeps the migration forward-compatible with fresh replay while
-- avoiding duplicate indexes when an equivalent left-prefix index already exists.

do $$
declare
  r record;
  v_columns text;
  v_index_name text;
begin
  for r in
    select c.oid as constraint_oid,
           c.conrelid,
           c.conkey,
           c.conname,
           n.nspname as schema_name,
           t.relname as table_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and t.relname like 'nutrition_%'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey
          and c.conkey @> (i.indkey::smallint[])[0:cardinality(c.conkey)-1]
      )
    order by t.relname, c.conname
  loop
    select string_agg(quote_ident(a.attname), ', ' order by u.ord)
      into v_columns
    from unnest(r.conkey) with ordinality u(attnum, ord)
    join pg_attribute a
      on a.attrelid = r.conrelid
     and a.attnum = u.attnum;

    v_index_name := left(
      'idx_' || r.table_name || '_' || replace(replace(v_columns, '"', ''), ', ', '_') || '_fk',
      54
    ) || '_' || substr(md5(r.conname), 1, 8);

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      v_index_name,
      r.schema_name,
      r.table_name,
      v_columns
    );
  end loop;
end
$$;
