begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $migration$
declare
  v_duplicate_pairs bigint;
  v_target_index regclass;
  v_legacy_index regclass;
begin
  if to_regclass('public.establishment_memberships') is null then
    raise exception 'Tabela public.establishment_memberships ausente.'
      using errcode = '42P01';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class r
      on r.oid = c.conrelid
    join pg_catalog.pg_namespace n
      on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname = 'establishment_memberships'
      and c.contype = 'u'
      and (
        select pg_catalog.array_agg(a.attname order by key_column.ordinality)
        from pg_catalog.unnest(c.conkey) with ordinality
          as key_column(attnum, ordinality)
        join pg_catalog.pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = key_column.attnum
      ) = array['establishment_id', 'user_id']::name[]
  ) then
    select count(*)
    into v_duplicate_pairs
    from (
      select establishment_id, user_id
      from public.establishment_memberships
      group by establishment_id, user_id
      having count(*) > 1
    ) duplicate_pairs;

    if v_duplicate_pairs > 0 then
      raise exception
        'Não foi possível restaurar UNIQUE(establishment_id, user_id): % pares duplicados encontrados.',
        v_duplicate_pairs
        using errcode = '23505';
    end if;

    v_target_index := to_regclass(
      'public.establishment_memberships_establishment_id_user_id_key'
    );
    v_legacy_index := to_regclass(
      'public.establishment_memberships_establishment_user_unique'
    );

    if v_target_index is not null then
      alter table public.establishment_memberships
        add constraint establishment_memberships_establishment_id_user_id_key
        unique using index establishment_memberships_establishment_id_user_id_key;
    elsif v_legacy_index is not null then
      alter table public.establishment_memberships
        add constraint establishment_memberships_establishment_id_user_id_key
        unique using index establishment_memberships_establishment_user_unique;
    else
      alter table public.establishment_memberships
        add constraint establishment_memberships_establishment_id_user_id_key
        unique (establishment_id, user_id);
    end if;
  end if;
end;
$migration$;

comment on constraint establishment_memberships_establishment_id_user_id_key
  on public.establishment_memberships is
  'Impede associação duplicada do mesmo usuário ao mesmo estabelecimento e sustenta upserts idempotentes.';

commit;
