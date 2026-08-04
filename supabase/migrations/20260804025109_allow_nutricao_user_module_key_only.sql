begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.user_module_permissions
  drop constraint if exists user_module_permissions_module_key_check;

alter table public.user_module_permissions
  add constraint user_module_permissions_module_key_check
  check (
    module_key in (
      'operacao',
      'estoque',
      'engenharia',
      'nutricao',
      'compras',
      'fiscal',
      'financeiro',
      'rh',
      'administracao'
    )
  );

notify pgrst, 'reload schema';

commit;
