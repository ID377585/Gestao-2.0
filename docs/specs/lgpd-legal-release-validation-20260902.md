# LGPD legal release validation — 2026-09-02

Status: validating

Esta evidência registra a revalidação do hardening jurídico/LGPD originalmente proposto na PR #83 contra a `main` atual após a incorporação do ledger append-only de compliance da PR #84.

## Invariantes preservados

- O ledger append-only de `user_terms_acceptances` permanece a fonte técnica de verdade para aceite explícito dos Termos.
- A política de governança não altera `CURRENT_TERMS_DOCUMENT_VERSION` nem converte aceites históricos em novos aceites.
- Nenhuma DDL/DML, RLS, grant, secret ou dado tenant é alterado por esta entrega jurídica.
- A Santino não é usada como ambiente de teste destrutivo.
- A nova política pública, links jurídicos, matriz orientativa de retenção e runbook de incidentes são aditivos e não interferem no fluxo de autenticação.

## Gates para release

A PR de release deve passar novamente pelos checks obrigatórios do repositório contra a `main` pós-#84 antes do merge.

Após o merge, validar CI da `main`, deployment Vercel Production e ausência de regressões operacionais imediatas.
