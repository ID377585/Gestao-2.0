# Spec — Visibilidade da senha no login

Status: implementing
Updated: 2026-09-02
Priority: P4

## Contexto

Usuários podem cometer erros de digitação em senhas sem conseguir conferir o conteúdo informado. A tela de login atual usa campo `type=password` sem controle de exibição.

## Comportamento esperado

- senha permanece oculta por padrão;
- usuário pode alternar entre mostrar e ocultar sem submeter o formulário;
- alternância não altera o valor digitado nem o fluxo Supabase Auth;
- controle deve ser acessível por teclado e leitor de tela;
- `autocomplete=current-password` deve permanecer;
- nenhum dado de senha deve ser logado ou persistido.

## Implementação

Adicionar botão dentro do campo de senha com ícones de olho/olho fechado, `type=button`, `aria-label`, `aria-pressed`, foco visível e área de toque confortável.

## Invariantes de segurança

- não altera hashing, armazenamento ou transporte da senha;
- não altera `supabase.auth.signInWithPassword`;
- senha continua oculta por padrão;
- nenhuma telemetria recebe o conteúdo do campo.

## Testes e aceitação

- campo inicia como `password`;
- botão alterna para `text` e volta para `password`;
- valor digitado permanece intacto;
- Enter continua submetendo o login;
- botão não submete o formulário;
- navegação por Tab alcança o controle;
- lint, typecheck, audit, tenant checks, readiness e build verdes;
- Vercel Preview da tela de login validado.

## Rollback

Reverter o commit da UI. Sem migration, banco ou mudança de configuração.
