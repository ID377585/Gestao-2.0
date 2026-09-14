# Spec — Resiliência de integrações externas

Status: implementing
Updated: 2026-09-02
Priority: P2

## Contexto e evidência

A rota `GET /api/weather/current` depende da Open-Meteo para geocodificação e clima. Nos erros recentes da Vercel há timeouts de conexão e respostas não-OK desse provedor. O clima é informação auxiliar e não pode produzir erro operacional relevante, bloquear navegação ou poluir os clusters de erro da aplicação.

## Problema

A implementação atual usa `fetch` sem timeout explícito para Open-Meteo, lança exceção quando o provedor retorna erro e registra `console.error` no fallback global. Isso faz uma dependência não crítica aparecer como erro de runtime do Gestify.

## Comportamento esperado

- dependências auxiliares falham de forma segura e silenciosa para o usuário;
- timeout explícito e curto para chamadas externas;
- retry limitado somente para falhas transitórias;
- cache de dados válidos para reduzir chamadas e absorver indisponibilidade curta;
- stale fallback best-effort quando houver uma resposta válida anterior;
- resposta HTTP 200 com payload `fallback` quando não houver dado externo disponível;
- ausência de `console.error` para indisponibilidade esperada do provedor;
- erros de auth, tenant e banco continuam independentes e não são mascarados por lógica de clima.

## Design técnico

1. Criar helper local para fetch JSON resiliente com timeout, retry limitado e cache do Next.
2. Armazenar último clima válido por coordenada em cache de memória best-effort com TTL stale.
3. Aplicar timeout também à geocodificação.
4. Em falha do provedor, retornar dado stale quando disponível; caso contrário, payload fallback.
5. Amostrar `console.warn` no máximo uma vez por janela por dependência, evitando clusters de erro e spam.

## Invariantes

- nenhuma alteração de banco, RLS, auth ou tenant;
- nenhuma chamada externa recebe segredos;
- coordenadas não são persistidas;
- a rota permanece rate-limited;
- contrato JSON consumido por `CurrentDateWeather` permanece compatível.

## Critérios de aceitação

- Open-Meteo indisponível => rota responde 200 com fallback/stale sem lançar erro;
- timeout externo não excede a janela configurada por tentativa;
- falha 5xx/429 pode ter uma única nova tentativa;
- 4xx não transitório não gera retry;
- `console.error("Erro ao carregar clima atual")` removido;
- lint, typecheck, audit, tenant checks, readiness e build verdes;
- Vercel Preview funcional.

## Rollback

Reverter a alteração da rota de clima. Não há migration nem transformação de dados.
