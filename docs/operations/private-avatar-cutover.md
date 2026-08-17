# Corte seguro do bucket de avatares para privado

Data: 2026-08-10

## Objetivo

Remover URLs públicas permanentes de fotos de perfil sem interromper a aplicação atual e sem permitir que o navegador decida autorização ou grave diretamente o vínculo do arquivo no perfil.

A arquitetura final é:

```text
ProfileModal
    │
    ▼
/api/user/avatar
    │ autenticação + origem + rate limit + validação JPEG
    ▼
profiles.avatar_path + Storage RLS
    │
    ▼
URL assinada de curta duração
```

## Por que o corte não é imediato

O projeto Supabase é compartilhado pela aplicação atualmente publicada e pelos Preview Deployments. A versão existente na `main` ainda usa `getPublicUrl()` e grava `profiles.avatar_url` diretamente no navegador.

Alterar `storage.buckets.public` para `false` antes de publicar o novo backend quebraria a exibição e o upload de avatar no sistema atual. Por isso o trabalho é dividido em duas fases.

## Fase A — preparação compatível

Concluída pela migration:

```text
20260810184500_prepare_private_avatar_storage.sql
```

Ela:

- adiciona `profiles.avatar_path`;
- adiciona `profiles.avatar_updated_at`;
- converte a URL pública já existente em caminho de objeto;
- limita o bucket a 2 MB;
- aceita somente `image/jpeg` após o processamento do cliente;
- cria leitura RLS do próprio diretório para usuários autenticados;
- preserva temporariamente o indicador público do bucket.

O código da branch também:

- move upload e remoção para `/api/user/avatar`;
- exige sessão válida no servidor;
- exige requisição de mesma origem para mutações;
- aplica rate limit por IP e por usuário;
- valida MIME, tamanho e assinatura binária JPEG;
- grava o caminho no perfil apenas após upload válido;
- remove objetos antigos do diretório do usuário;
- entrega a imagem por redirecionamento para URL assinada;
- remove do `ProfileModal` o acesso direto a Storage, `profiles` e `getPublicUrl()`.

## Pré-condições da Fase B

O corte só pode ocorrer depois de todos estes itens:

- [ ] a branch compatível foi promovida para `main`;
- [ ] o deployment de produção está `READY` no mesmo commit;
- [ ] login, logout e refresh de sessão foram testados;
- [ ] upload JPEG, PNG, WebP, GIF e HEIC foi testado pela interface;
- [ ] remoção de avatar foi testada;
- [ ] o Topbar atualizou a imagem após refresh de sessão;
- [ ] um segundo usuário não conseguiu acessar o objeto do primeiro;
- [ ] não existe uso de `getPublicUrl()` para o bucket `avatars` no código de produção;
- [ ] não existe escrita direta em `profiles.avatar_url` no cliente;
- [ ] foi registrada a quantidade de objetos e perfis antes do corte;
- [ ] existe uma cópia externa ou listagem auditável dos objetos atuais.

Consultas de pré-corte:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'avatars';

select
  count(*) filter (where avatar_path is not null) as profiles_with_path,
  count(*) filter (
    where avatar_url like '%/storage/v1/object/public/avatars/%'
  ) as profiles_with_legacy_public_url
from public.profiles;

select count(*) as avatar_objects
from storage.objects
where bucket_id = 'avatars';
```

## SQL da Fase B

Executar em janela controlada, depois do deployment compatível:

```sql
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

update storage.buckets
set
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg']
where id = 'avatars';

drop policy if exists "Public can view avatars" on storage.objects;

update public.profiles
set avatar_url = null
where avatar_url like '%/storage/v1/object/public/avatars/%';

-- Remove apenas a URL pública legada do metadata e preserva os demais campos.
update auth.users as users
set raw_user_meta_data =
  (coalesce(users.raw_user_meta_data, '{}'::jsonb) - 'avatar_url')
  || case
       when profiles.avatar_path is not null
         then jsonb_build_object('avatar_path', profiles.avatar_path)
       else '{}'::jsonb
     end
from public.profiles as profiles
where profiles.id = users.id
  and (
    coalesce(users.raw_user_meta_data ->> 'avatar_url', '') like
      '%/storage/v1/object/public/avatars/%'
    or profiles.avatar_path is not null
  );

notify pgrst, 'reload schema';

commit;
```

Depois do corte, criar uma migration versionada que também remova `avatars` da exceção de buckets públicos na função `gestify_core_security_audit()` e eleve a versão do contrato.

## Validação pós-corte

- [ ] `storage.buckets.public = false` para `avatars`;
- [ ] uma URL pública antiga falha sem sessão;
- [ ] `/api/user/avatar` redireciona para URL assinada quando autenticado;
- [ ] a URL assinada expira;
- [ ] upload acima de 2 MB é recusado no servidor;
- [ ] arquivo que declara JPEG sem assinatura `FF D8 FF` é recusado;
- [ ] requisição cross-site de POST ou DELETE é recusada;
- [ ] usuário A não acessa caminho do usuário B;
- [ ] upload novo remove objetos antigos do mesmo usuário;
- [ ] remoção limpa o vínculo e os objetos;
- [ ] `gestify_core_security_audit()` retorna `ok=true` após retirar a exceção.

## Rollback emergencial

Somente se a nova rota falhar em produção e não houver correção rápida:

```sql
update storage.buckets
set public = true
where id = 'avatars';
```

O rollback deve ser temporário, registrado em auditoria e seguido de correção e novo corte. Não restaurar escrita direta do navegador em `profiles` nem voltar a persistir URLs públicas como solução definitiva.
