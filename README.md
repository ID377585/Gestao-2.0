# Gestão 2.0

Sistema web completo para gestão operacional, produtiva, fiscal e administrativa de restaurantes, padarias, confeitarias, cozinhas industriais e estabelecimentos de produção alimentícia.

O projeto centraliza em uma única plataforma os processos de:

- pedidos
- produção
- estoque
- inventário
- fichas técnicas
- etiquetas
- produtividade
- usuários e permissões
- histórico operacional
- análises e exportações

Construído com **Next.js 14**, **TypeScript**, **Supabase** e **Tailwind CSS**, o sistema foi pensado para oferecer velocidade operacional, rastreabilidade e melhor tomada de decisão.

---

## Visão geral

O Gestão 2.0 foi criado para resolver dores comuns da operação de alimentos:

- dificuldade para controlar pedidos em várias etapas
- falta de visibilidade da produção em tempo real
- erros de estoque e divergências de inventário
- baixa rastreabilidade de lotes e etiquetas
- dificuldade para medir produtividade da equipe
- pouca padronização no custo de receitas e produtos
- excesso de planilhas e controles paralelos

Com o sistema, a empresa ganha:

- mais controle operacional
- mais velocidade na produção
- redução de perdas
- melhor previsibilidade de compra e fabricação
- dados mais confiáveis para tomada de decisão
- histórico e auditoria das ações críticas

---

## Principais benefícios do sistema

### Operação mais organizada
O fluxo de pedidos acompanha as etapas reais da operação, evitando perda de status, retrabalho e falta de visibilidade.

### Estoque mais confiável
Entradas, saídas, inventário e ajustes passam a refletir melhor a realidade do estoque atual.

### Produção com acompanhamento real
A área de produção e produtividade mostra volume produzido, tempos médios, ranking e visão por colaborador e setor.

### Ficha técnica com apoio à rentabilidade
As receitas e composições permitem calcular custo, rendimento e estrutura de produção com mais consistência.

### Rastreabilidade
Etiquetas, lotes, inventários e histórico de movimentações ajudam na conferência e na segurança operacional.

### Escalabilidade
A arquitetura foi organizada para crescer com novos módulos e novas rotinas internas.

---

## Funcionalidades atuais

## 1. Pedidos
- criação de pedidos
- itens por pedido
- fluxo por status
- histórico de movimentação
- visão operacional do pedido
- detalhamento por etapa

## 2. Produção / KDS
- quadro de produção por etapa
- acompanhamento por item
- definição de responsável
- avanço de status operacional
- visão de itens pendentes, em preparo e pós-preparo

## 3. Estoque
- estoque atual
- configuração de mínimo, médio e máximo
- atualização de local e unidade
- exportação CSV
- upload CSV para metadados de estoque
- alertas para níveis críticos

## 4. Inventário
- abertura de inventário
- leitura por QR Code
- lançamento manual de insumos
- histórico de inventários
- comparação entre contado e estoque anterior
- aplicação de diferenças no estoque

## 5. Fichas técnicas
- cadastro de receitas
- ingredientes e quantidades
- cálculo de custo
- apoio ao CMV e controle de produção

## 6. Etiquetas
- leitura e rastreio de etiquetas
- impressão e histórico
- apoio à identificação de produtos e lotes

## 7. Produtividade
- ranking de colaboradores
- produção por setor
- produtos mais produzidos
- previsão com base em histórico
- refugo por setor

## 8. Histórico e análises
- histórico de pedidos
- histórico de inventários
- visão analítica para acompanhamento gerencial

## 9. Administração de usuários
- cadastro
- edição
- ativação e desativação
- redefinição de senha
- auditoria de ações
- controle por papéis de acesso

## 10. Alertas e notificações
- base para alertas de estoque baixo
- alertas operacionais
- estrutura preparada para alertas por e-mail e regras de domínio

---

## Tecnologias utilizadas

### Frontend
- Next.js 14
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React

### Backend
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Storage

### Infra e deploy
- Vercel
- variáveis de ambiente por ambiente
- rotas server-side e client-side

---

## Arquitetura resumida

O projeto usa **Next.js App Router** com separação entre:

- páginas do dashboard
- componentes de interface reutilizáveis
- ações server-side
- bibliotecas utilitárias
- integração com Supabase
- APIs auxiliares

---

## Estrutura sugerida do projeto

```bash
src/
  app/
    (dashboard)/
      dashboard/
        pedidos/
        producao/
        estoque/
        inventario/
        historico-pedidos/
        produtividade/
        admin/
  components/
    ui/
    layout/
    dashboard/
    modals/
  hooks/
  lib/
    auth/
    supabase/
    alerts/
    format/
  app/api/
public/
supabase/