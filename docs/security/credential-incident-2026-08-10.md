# Incidente de credenciais — 2026-08-10

## Classificação

**Severidade: crítica.**

Foi identificado um script versionado contendo uma chave administrativa legada do Supabase e uma senha de usuário em texto puro. Os valores não devem ser copiados para tickets, logs, mensagens ou documentação.

## Contenção aplicada no repositório

- Remoção do script da árvore atual da branch de correção.
- Remoção dos arquivos gerados em `supabase/.temp/`, que já estavam cobertos pelo `.gitignore`, mas continuavam rastreados pelo Git.
- Manutenção de `.env` e segredos fora do repositório.

A remoção do arquivo na árvore atual **não invalida a chave** e **não elimina o conteúdo do histórico Git**. Rotação e saneamento do histórico continuam obrigatórios.

## Sequência obrigatória de resposta

1. Criar uma nova chave secreta `sb_secret_...` no projeto Supabase e não reutilizar a chave exposta.
2. Atualizar os ambientes Production, Preview e Development da Vercel e qualquer worker, cron, integração ou máquina que use acesso administrativo.
3. Implantar e validar os fluxos administrativos com a nova chave.
4. Desativar a chave legada `service_role` comprometida depois que nenhum componente depender dela.
5. Forçar a troca da senha afetada e revogar todas as sessões do usuário envolvido.
6. Migrar o projeto para chaves publicáveis/secretas independentes e para assinatura JWT assimétrica.
7. Reescrever o histórico com `git filter-repo`, coordenando um clone novo para todos os colaboradores e integrações.
8. Revisar logs de Auth, API, Storage e banco no período anterior à rotação em busca de uso administrativo inesperado.

## Critérios para encerrar o incidente

- A chave exposta não é mais aceita pelo Supabase.
- A senha exposta foi substituída e as sessões anteriores foram revogadas.
- Produção e previews usam apenas a nova chave secreta armazenada no gerenciador de ambientes.
- O histórico publicado foi saneado e todos os clones antigos foram descartados.
- A varredura automática de segredos está ativa no CI.

## Proibições permanentes

- Nunca versionar chaves `service_role`, `sb_secret_...`, senhas, tokens, cookies ou arquivos `.env`.
- Nunca usar segredos em variáveis `NEXT_PUBLIC_*`.
- Nunca enviar chaves por URL ou query string.
- Nunca registrar valores completos de credenciais em logs ou mensagens de erro.
