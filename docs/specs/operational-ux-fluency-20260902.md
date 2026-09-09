# Spec — Operational UX fluency

Status: implementing
Updated: 2026-09-02
Priority: P4

## Contexto

O shell principal já possui navegação client-side responsiva e loading skeletons nas rotas operacionais principais. A oportunidade de melhoria está no feedback imediato durante transições, clareza do item ativo e acessibilidade de navegação, sem redesenhar os fluxos existentes.

## Problema

Em transições que dependem de dados/server rendering, o clique pode não produzir feedback visual imediato no shell. Além disso, links ativos não expõem `aria-current`, reduzindo clareza para tecnologia assistiva.

## Comportamento esperado

- qualquer navegação interna iniciada pelo usuário deve produzir feedback visual discreto enquanto o pathname ainda não mudou;
- o feedback não deve bloquear interação nem causar layout shift;
- links ativos devem expor `aria-current="page"`;
- alvos de navegação devem manter área de toque confortável;
- rotas e contratos funcionais não devem mudar.

## Design

1. Adicionar `NavigationProgress` no shell compartilhado.
2. Detectar cliques em links internos navegáveis e exibir uma barra de progresso não bloqueante.
3. Encerrar o estado pendente quando `usePathname()` mudar ou por timeout defensivo.
4. Marcar links ativos com `aria-current="page"`.
5. Ajustar altura mínima dos itens de navegação desktop para 44px.

## Invariantes

- sem mudanças de banco, auth, RLS ou tenant;
- sem navegação programática nova;
- sem impedir Ctrl/Cmd/Shift/Alt-click, links externos, downloads ou targets externos;
- respeitar `prefers-reduced-motion` via classes de animação existentes/condicionais CSS.

## Testes

- lint e typecheck;
- build;
- validar desktop/mobile e teclado;
- confirmar que abrir link em nova aba não aciona progresso indevido;
- confirmar ausência de layout shift.

## Rollback

Remover `NavigationProgress` do layout e reverter os atributos/classes adicionados à navegação. Nenhum dado é alterado.
