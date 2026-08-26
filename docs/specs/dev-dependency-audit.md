# Development dependency vulnerability audit

Status: implementing
Priority: P2
Issue: #17

## Contexto

O gate de produção (`npm audit --omit=dev --audit-level=high`) está limpo, mas a issue #17 registra um achado alto no grafo completo. Precisamos identificar a cadeia exata antes de atualizar dependências.

## Regras

- não usar `npm audit fix --force`;
- não rebaixar dependências para contornar advisory;
- preservar Next/React/Supabase/Excel funcionais;
- diagnosticar o pacote e a cadeia primeiro;
- depois aplicar a menor atualização/override compatível e validar `npm ci`, audit completo, CI e Preview.

## Critério

`npm audit --audit-level=high` deve terminar sem vulnerabilidade alta/critical no grafo completo ou existir justificativa formal temporária com pacote, escopo e mitigação.
