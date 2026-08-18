# SPEC-001 — Staging migration integrity before QA bootstrap

Status: proposed
Priority: P1
Owner: Gestify Daily Maintainer
Related PR: #40, #41

## Contexto e evidência

O Gestify já possui um projeto Supabase dedicado de staging (`tuncavkhjazruijujatb`), mas o ambiente ainda não contém migrations aplicadas nem o schema público do produto. Isso impede homologação funcional real e criação segura dos tenants artificiais de QA.

O PR #40 adiciona um gate de replay limpo das migrations em PostgreSQL 17. No run `32062821164`, todas as 108 migrations foram aplicadas com sucesso em um banco descartável, porém o `supabase db lint --local --level error --fail-on error` falhou em `public.advance_order_status` porque a função referencia `public.order_status_transitions`, relação ausente no replay limpo.

A produção possui `public.order_status_transitions` com as colunas `from_status order_status`, `to_status order_status` e `enabled boolean not null default true`, chave primária `(from_status, to_status)`, RLS habilitada/forçada e seis transições ativas. Portanto existe drift entre o estado real hospedado e o histórico reproduzível das migrations.

O PR #41 prepara um caminho protegido para aplicar migrations somente em staging, mas não deve ser usado enquanto o replay limpo permanecer vermelho.

## Problema

O histórico de migrations não reconstrói integralmente um contrato de banco necessário ao runtime atual. Aplicar a cadeia no staging nesse estado criaria um ambiente incompleto e faria a homologação produzir falsos negativos ou comportamento diferente da produção.

## Impacto

- bloqueia bootstrap confiável do `gestify-staging`;
- bloqueia Staging QA Robot com tenants artificiais Alpha/Beta;
- impede afirmar que uma instalação nova do Gestify reproduz o schema esperado;
- aumenta risco de drift entre produção, staging e disaster recovery;
- mantém o release comercial bloqueado por migration inconsistente.

## Comportamento atual

1. `supabase start` reconstrói as 108 migrations de `main`.
2. `public.advance_order_status` é criada e referencia `public.order_status_transitions`.
3. A tabela não existe no replay limpo.
4. `supabase db lint` retorna SQLSTATE `42P01`.
5. O staging persistente permanece vazio e não pode ser homologado com segurança.

## Comportamento esperado

Uma instalação limpa deve reconstruir de forma idempotente o mesmo contrato mínimo de `order_status_transitions` usado pelo runtime, sem depender de estado manual existente em produção. O replay deve concluir com lint verde antes de qualquer apply no staging persistente.

## Invariantes

- tenant isolation permanece inalterado;
- nenhuma mutation deve ser executada em Supabase produção durante implementação/validação;
- nenhuma alteração deve atingir dados ou usuários da Empresa Santino;
- `order_status_transitions` continua sendo tabela de referência, não tenant-scoped;
- nenhuma permissão adicional para `anon` deve ser introduzida;
- RLS deve permanecer habilitada e forçada quando a tabela existir;
- fluxos ativos de pedidos em produção não podem ser alterados por este PR;
- a mudança deve ser reversível e compatível com bancos onde a tabela já existe.

## Escopo

- versionar o contrato ausente de `public.order_status_transitions` em migration nova e idempotente;
- reconstruir a chave primária e o conjunto canônico de transições esperado pelo runtime;
- preservar o comportamento de RLS/grants observado em produção;
- validar replay limpo em PostgreSQL 17;
- somente após replay verde, validar o plano remoto de staging e então permitir o bootstrap protegido.

## Fora de escopo

- alterar policies de `orders` ou `order_status_events`;
- revogar/grantar RPCs `SECURITY DEFINER`;
- limpar dados de produção;
- aplicar migrations em produção;
- criar tenants/usuários QA antes do staging estar íntegro;
- modificar qualquer usuário, membership ou dado da Empresa Santino.

## Design técnico

A correção deve ser uma migration aditiva posterior às migrations atuais. Não editar migrations já aplicadas em produção.

A migration deve ser segura nos dois cenários:

1. banco limpo, onde `order_status_transitions` não existe;
2. banco hospedado, onde a tabela já existe com o contrato esperado.

Preferir `create table if not exists`/guards equivalentes, constraints idempotentes, RLS explícita e seed canônico com conflito tratado sem sobrescrever dados existentes desnecessariamente.

## Banco / migrations / RLS

Contrato mínimo observado em produção:

- `from_status public.order_status not null`;
- `to_status public.order_status not null`;
- `enabled boolean not null default true`;
- primary key `(from_status, to_status)`;
- RLS habilitada e forçada;
- policy de leitura `gestify_order_status_transitions_read` para `authenticated`;
- nenhuma permissão `anon`.

Transições ativas observadas em produção:

- `pedido_criado -> aceitou_pedido`;
- `aceitou_pedido -> em_preparo`;
- `em_preparo -> em_separacao`;
- `em_separacao -> em_faturamento`;
- `em_faturamento -> em_transporte`;
- `em_transporte -> entregue`.

A implementação deve tratar esses valores como contrato funcional a ser confirmado contra o código de pedidos antes do merge.

## API / server actions

Nenhuma alteração esperada nesta spec. `advance_order_status` deve apenas deixar de referenciar uma relação ausente em instalações limpas.

## UI / UX

Sem alterações.

## Observabilidade

Registrar como evidência do PR:

- run do replay limpo;
- resultado do `supabase db lint`;
- lista de migrations aplicada no ambiente descartável;
- diff/plan remoto do staging;
- Supabase Advisors do staging após eventual bootstrap.

## Testes

Obrigatórios antes de marcar a implementação como validada:

1. integridade de nomes/timestamps de migrations;
2. replay completo em PostgreSQL 17 desde banco vazio;
3. `supabase db lint --local --level error --fail-on error` verde;
4. confirmar existência, PK, RLS e seis transições no banco descartável;
5. executar o contrato/auditoria de pedidos existente;
6. executar CI normal (`lint`, `typecheck`, `audit`, tenant/readiness/build conforme disponível);
7. executar `supabase db push --linked --dry-run` contra `gestify-staging`;
8. somente depois do dry-run revisado, usar o fluxo protegido do PR #41 para apply/verify no staging;
9. reexecutar Security Advisors no staging.

## Critérios de aceitação

- replay limpo não contém erro `relation public.order_status_transitions does not exist`;
- migration integrity gate fica verde;
- nenhum novo erro de lint de banco é introduzido;
- staging continua diferente de produção e sem dados Santino;
- dry-run remoto aponta apenas migrations esperadas;
- após bootstrap autorizado do staging, os contratos de pedidos/RLS passam;
- nenhum merge/deploy/migration de produção ocorre automaticamente.

## Rollout em staging

1. Corrigir e deixar verde o replay descartável.
2. Revisar o artifact/log do replay.
3. Executar o workflow de plan contra `tuncavkhjazruijujatb`.
4. Confirmar target por project ref, nome e região.
5. Aplicar exclusivamente no staging pelo fluxo protegido.
6. Rodar verify, lint, Advisors e contratos.
7. Somente então criar tenants QA artificiais, explicitamente não-Santino.

## Plano de produção

Nenhuma ação de produção nesta spec. Uma futura promoção depende de revisão humana específica, CI verde, validação staging e plano de rollback. Como a produção já possui a tabela, a migration deve ser essencialmente idempotente nesse ambiente.

## Rollback

Enquanto a mudança existir apenas em branch/PR, rollback é fechar o PR. Em staging, se a migration apenas reconstruir contrato ausente e seeds de referência, preferir reset/recriação do staging em vez de DDL destrutiva manual. Produção não participa desta fase.

## Evidências de validação

Baseline desta rodada:

- `main`: `b76fd84ab316b9e8414d19134867b18efa6f0b46`;
- staging migrations aplicadas: `0`;
- PR #40 migration replay: migrations aplicadas, lint falha em `public.advance_order_status` por ausência de `public.order_status_transitions`;
- produção: tabela existe com PK, RLS forçada e seis transições ativas;
- Vercel produção: único cluster de erro recente é `refresh_token_not_found` em middleware, sem relação causal com esta spec;
- Supabase produção: permanecem warnings conhecidos de RPCs `SECURITY DEFINER`; fora do escopo desta tarefa.
