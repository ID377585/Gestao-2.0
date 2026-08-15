# Gestify

**Plataforma SaaS multiempresa para gestão operacional, produtiva, sanitária, administrativa e estratégica de negócios do setor alimentício.**

O Gestify centraliza pedidos, produção, estoque, inventário, fichas técnicas, perdas, rastreabilidade, produtividade, usuários, permissões e indicadores em um único ambiente seguro e integrado.

Desenvolvido para restaurantes, padarias, confeitarias, cozinhas industriais, fábricas de alimentos, redes e operações com múltiplas unidades, o sistema transforma processos fragmentados em fluxos digitais rastreáveis, padronizados e orientados por dados.

> O Gestify está em desenvolvimento e homologação. Funcionalidades, integrações e controles regulatórios podem variar conforme o estágio de implantação.

---

## Visão do produto

Operações alimentícias normalmente dependem de planilhas, mensagens, controles manuais e sistemas que não compartilham informações entre si. Isso reduz a confiabilidade dos dados e dificulta o acompanhamento de pedidos, produção, estoque, custos, perdas e desempenho.

O Gestify foi criado para reunir esses processos em uma plataforma SaaS modular, oferecendo:

* gestão centralizada da operação;
* separação segura entre empresas e unidades;
* acompanhamento de pedidos e produção;
* controle de estoque, inventário e perdas;
* padronização por fichas técnicas;
* rastreabilidade de produtos, etiquetas e movimentações;
* controle de usuários, funções e permissões;
* registros de auditoria para ações críticas;
* relatórios e indicadores para tomada de decisão;
* base preparada para automações e integrações.

---

## Arquitetura SaaS multiempresa

O Gestify utiliza uma arquitetura multiempresa baseada em organizações, estabelecimentos, usuários, vínculos e permissões.

Cada operação de negócio é associada a um estabelecimento:

```text
Usuário
   │
   ▼
Membership
   │
   ▼
Empresa / Estabelecimento
   │
   ├── Pedidos
   ├── Produção
   ├── Estoque
   ├── Inventários
   ├── Fichas técnicas
   ├── Perdas
   ├── Usuários
   └── Relatórios
```

O isolamento não depende apenas da interface. A autorização é verificada no servidor e reforçada no PostgreSQL por meio de Row-Level Security — RLS.

Conceitualmente, cada operação protegida considera:

```text
usuário autenticado
+ empresa ativa
+ vínculo com a empresa
+ papel ou permissão
+ política RLS
```

Essa estrutura permite que um mesmo usuário participe de mais de uma empresa sem misturar informações entre tenants.

---

## Principais áreas do Gestify

### Pedidos

* criação e acompanhamento de pedidos;
* itens e detalhes por pedido;
* fluxo por status operacional;
* aceite, avanço, cancelamento e reabertura;
* histórico de alterações;
* separação de itens e etiquetas;
* acompanhamento em tempo real;
* proteção contra operações duplicadas nos fluxos críticos.

### Produção e KDS

* quadro de produção por etapa;
* acompanhamento de itens pendentes e em preparo;
* definição de responsáveis;
* avanço de status;
* organização por setor;
* acompanhamento de produtividade;
* histórico da operação;
* integração com estoque e rastreabilidade.

### Estoque

* saldo atual por produto;
* entradas, saídas e ajustes;
* níveis mínimo, médio e máximo;
* localização e unidade de medida;
* alertas de estoque;
* movimentações auditáveis;
* exportação e importação de dados;
* proteção transacional em operações críticas.

### Inventário

* abertura e acompanhamento de inventários;
* leitura por QR Code;
* lançamento manual;
* comparação entre quantidade contada e saldo anterior;
* aplicação controlada de diferenças;
* histórico de inventários;
* rastreabilidade dos ajustes realizados.

### Perdas

* registro de perdas com ou sem etiqueta;
* baixa transacional de estoque;
* anexação de evidências;
* auditoria de saldo;
* prevenção de baixa duplicada;
* rollback em caso de saldo insuficiente;
* isolamento entre estabelecimentos.

### Fichas técnicas e receitas

* cadastro de receitas e preparações;
* ingredientes e quantidades;
* rendimento;
* estrutura de composição;
* cálculo de custo;
* apoio ao CMV;
* imagens armazenadas de forma privada;
* base para padronização e planejamento da produção.

### Etiquetas e rastreabilidade

* criação e impressão de etiquetas;
* leitura por QR Code;
* identificação de produtos e lotes;
* histórico de etiquetas;
* rastreamento de movimentações;
* apoio ao controle de validade e produção.

### Produtividade

* produtividade por colaborador;
* produção por setor;
* volume produzido;
* tempos operacionais;
* ranking de desempenho;
* produtos mais produzidos;
* registro de refugos;
* análises baseadas no histórico.

### Nutrição e segurança dos alimentos

* base operacional para inspeções;
* registros de higienização;
* planos de ação e não conformidades;
* treinamentos;
* documentos e versões;
* relatórios;
* notificações e entregas;
* trilha de auditoria.

> Os recursos de nutrição e segurança dos alimentos apoiam a gestão interna. Obrigações técnicas ou regulatórias continuam dependendo da validação de profissionais responsáveis.

### Usuários e permissões

* cadastro e gerenciamento de usuários;
* ativação e desativação;
* redefinição de senha;
* participação em múltiplas empresas;
* papéis especializados;
* permissões por módulo;
* controle de acesso no servidor;
* auditoria de ações administrativas.

### RH e Ponto Digital

* controle interno de jornada;
* marcações operacionais;
* selfie como evidência;
* foto de referência;
* escalas e horários;
* banco de horas;
* acompanhamento da jornada.

> O Ponto Digital é um recurso de controle interno. Não deve ser apresentado como REP legal ou sistema oficial de registro eletrônico sem homologação técnica e jurídica específica.

### Alertas, notificações e tarefas automáticas

* alertas operacionais;
* alertas de estoque;
* notificações internas;
* estrutura para envio de e-mails;
* processamento assíncrono;
* retentativas;
* deduplicação de tarefas;
* recuperação de jobs interrompidos;
* fila de tarefas com controle de lease.

### Histórico, auditoria e análises

* histórico de pedidos;
* histórico de inventários;
* registros de movimentações;
* ações administrativas;
* eventos de segurança;
* telemetria de acesso;
* relatórios operacionais;
* exportações;
* indicadores gerenciais.

### Player de música

* rádio por streaming HTTPS;
* suporte ao player oficial incorporado do YouTube;
* configuração por estabelecimento;
* reprodução persistente durante a navegação.

---

## Segurança

A segurança do Gestify é baseada em múltiplas camadas.

### Autenticação e sessão

* autenticação pelo Supabase Auth;
* sessão SSR;
* cookies seguros;
* renovação de access token;
* rotação de refresh token;
* logout local e global;
* revogação de sessões;
* proteção de rotas no servidor;
* suporte à exigência de MFA administrativo.

### Isolamento multiempresa

* `establishment_id` nas entidades de negócio;
* vínculo do usuário por membership;
* resolução da empresa ativa no servidor;
* validação de tenant nas operações;
* contenção de cookie de empresa adulterado;
* RLS no PostgreSQL como barreira adicional.

### Autorização

* papéis especializados;
* permissões por módulo;
* validação de membership;
* autorização em APIs e Server Actions;
* proteção de RPCs privilegiadas;
* service role restrita ao servidor.

### Banco de dados

* PostgreSQL;
* Row-Level Security;
* migrations versionadas;
* funções transacionais;
* grants explícitos;
* tabelas internas sem acesso pelo navegador;
* trilhas de auditoria;
* evidências imutáveis de conformidade;
* verificações automatizadas de segurança.

### Proteção da aplicação

* validação de dados com Zod;
* sanitização e normalização de inputs;
* CORS restritivo;
* Content Security Policy;
* proteção contra framing;
* HSTS;
* proteção contra MIME sniffing;
* rate limiting em endpoints selecionados;
* respostas de erro sem exposição de stack trace;
* endpoints de diagnóstico condicionados ao ambiente.

### Segredos

Segredos administrativos nunca devem ser enviados ao navegador.

Exemplos exclusivamente server-side:

```text
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
JOBS_WORKER_SECRET
FISCAL_SYNC_SECRET
RESEND_API_KEY
```

Variáveis com prefixo `NEXT_PUBLIC_` devem conter somente informações publicáveis.

---

## Transações

Operações que alteram múltiplos registros devem ser executadas de forma atômica.

Exemplos:

```text
finalizar produção
        │
        ├── baixar insumos
        ├── atualizar produto acabado
        ├── registrar movimentações
        ├── registrar custos
        └── criar auditoria
```

O resultado esperado é:

```text
todas as etapas concluídas → COMMIT
qualquer etapa falhou      → ROLLBACK
```

O Gestify já utiliza funções PostgreSQL e RPCs transacionais em fluxos críticos, especialmente em pedidos, perdas e estoque. A cobertura transacional dos demais módulos continua sendo ampliada e auditada.

---

## Idempotência

A idempotência protege operações contra duplicidade causada por:

* cliques repetidos;
* conexão instável;
* timeout;
* reenvio automático;
* retry de worker;
* repetição de webhook.

A fundação de idempotência do Gestify utiliza:

* chave de idempotência;
* usuário;
* estabelecimento;
* tipo de operação;
* hash do payload;
* status de processamento;
* lease temporário;
* armazenamento da resposta;
* expiração controlada.

Operações críticas devem exigir idempotência, especialmente:

* pedidos;
* movimentações de estoque;
* produção;
* perdas;
* pagamentos;
* webhooks;
* emissão fiscal;
* importações;
* tarefas assíncronas.

---

## Filas e processamento assíncrono

Processos demorados não devem bloquear a experiência do usuário.

```text
Aplicação
   │
   ▼
Fila de jobs
   │
   ▼
Worker
   │
   ├── e-mails
   ├── notificações
   ├── relatórios
   ├── integrações
   ├── processamento de arquivos
   └── rotinas automáticas
```

A infraestrutura de filas contempla:

* deduplicação;
* prioridade;
* tentativas;
* retry com atraso;
* lease;
* heartbeat;
* recuperação de jobs abandonados;
* dead jobs;
* limpeza de registros expirados.

---

## Auditoria e conformidade

O Gestify mantém registros para apoiar segurança, rastreabilidade e conformidade:

* login e falhas de autenticação;
* acesso a áreas protegidas;
* ações administrativas;
* alterações operacionais;
* movimentações de estoque;
* eventos de segurança;
* aceite de termos;
* versão dos termos aceita;
* empresa e sessão relacionadas;
* data e origem da evidência.

Registros de conformidade e auditoria críticos são projetados para impedir alteração ou exclusão indevida.

Os logs não devem armazenar:

* senhas;
* tokens;
* cookies;
* chaves privadas;
* dados de cartão;
* informações sensíveis desnecessárias.

---

## Performance e experiência

O Gestify foi estruturado para oferecer uma experiência rápida e responsiva por meio de:

* Next.js App Router;
* React Server Components;
* processamento server-side;
* consultas com escopo de tenant;
* índices PostgreSQL;
* connection pooling;
* operações assíncronas;
* carregamento progressivo;
* componentes reutilizáveis;
* Realtime em fluxos compatíveis;
* otimização de assets;
* health checks;
* readiness checks.

A performance deve ser acompanhada continuamente com métricas reais, testes de carga e análise das consultas mais utilizadas.

---

## Continuidade e recuperação

A estratégia de continuidade contempla:

* migrations reproduzíveis;
* testes de reconstrução do banco;
* disaster recovery drill;
* backup criptografado;
* backup externo;
* backup de arquivos do Storage;
* verificação periódica de restauração;
* definição de RPO e RTO;
* procedimentos de rollback.

---

## Tecnologias

### Aplicação

* Next.js 16.2.12;
* React 19.2;
* TypeScript;
* Tailwind CSS;
* shadcn/ui;
* Lucide React;
* Zod 4.

### Backend e dados

* Supabase;
* PostgreSQL 17;
* Supabase Auth;
* Supabase Realtime;
* Supabase Storage;
* APIs e Server Actions;
* funções PostgreSQL e RPCs;
* Row-Level Security.

### Infraestrutura

* Vercel;
* Supabase;
* GitHub Actions;
* ambientes separados de Development, Preview e Production;
* migrations versionadas;
* filas e workers;
* tarefas agendadas;
* health checks;
* disaster recovery drills.

---

## Arquitetura resumida

```text
Usuário
   │
   ▼
Gestify Web — Next.js
   │
   ├── Middleware
   ├── Server Actions
   └── API Routes
          │
          ▼
Autenticação e autorização
   │
   ├── Sessão
   ├── Tenant
   ├── Membership
   ├── RBAC
   └── Validação
          │
          ▼
Supabase
   │
   ├── PostgreSQL + RLS
   ├── Auth
   ├── Storage privado
   └── Realtime
          │
          ▼
Filas, workers e integrações
```

A regra central da arquitetura é:

> O navegador solicita a operação. O servidor valida o usuário, a empresa, as permissões e os dados. O banco aplica RLS como uma camada adicional de proteção.

---

## Estrutura do projeto

```text
src/
├── app/
│   ├── (dashboard)/
│   ├── api/
│   └── fluxos públicos
├── components/
├── hooks/
├── lib/
│   ├── auth/
│   ├── audit/
│   ├── idempotency/
│   ├── queue/
│   ├── security/
│   ├── supabase/
│   └── tenant/
├── types/
└── utils/

supabase/
└── migrations/

scripts/
├── auditorias
├── readiness
├── testes de contrato
└── disaster recovery

.github/
└── workflows/
```

---

## Qualidade e CI/CD

A pipeline automatizada verifica:

* lint;
* TypeScript;
* dependências;
* imports de runtime;
* gravações com escopo de tenant;
* contratos do Supabase;
* políticas RLS;
* segurança do núcleo;
* prontidão para produção;
* replay completo das migrations;
* build do Next.js;
* testes de disaster recovery.

Fluxo esperado:

```text
Pull Request
   │
   ▼
Auditorias e testes
   │
   ▼
Build
   │
   ▼
Preview
   │
   ▼
Homologação
   │
   ▼
Produção
```

Nenhuma alteração de banco ou aplicação deve ser promovida sem migrations versionadas, testes aprovados, backup e plano de rollback.

---

## Variáveis de ambiente

### Públicas

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=
```

### Exclusivamente server-side

```env
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
ALERTS_FROM_EMAIL=
CRON_SECRET=
JOBS_WORKER_SECRET=
FISCAL_SYNC_SECRET=
```

Use valores independentes para:

* Development;
* Preview;
* Staging;
* Production.

Nunca envie arquivos `.env` ou credenciais reais ao repositório.

---

## Estado do projeto

O Gestify está em evolução contínua e passa por um processo de consolidação para operação SaaS comercial.

As prioridades atuais incluem:

* homologação em staging persistente;
* consolidação integral das migrations e políticas RLS;
* rotação e segregação de credenciais;
* testes E2E;
* monitoramento de performance;
* rate limiting distribuído;
* backup externo de banco e Storage;
* integração completa de pagamentos;
* validação de recuperação de desastre;
* fortalecimento da observabilidade;
* revisão de conformidade e LGPD.

---

## Princípios do Gestify

1. Nenhuma empresa deve acessar dados de outra empresa.
2. O frontend nunca é a autoridade final sobre permissões.
3. Toda operação crítica deve ser validada no servidor.
4. RLS deve proteger os dados mesmo diante de erro da aplicação.
5. Alterações críticas devem ser transacionais.
6. Operações repetíveis devem ser idempotentes.
7. Segredos nunca devem ser enviados ao navegador.
8. Logs não devem expor credenciais ou dados sensíveis.
9. Migrations devem ser reproduzíveis e auditáveis.
10. Nenhuma release deve chegar à produção sem testes, backup e possibilidade de rollback.

---

## Aviso

O Gestify é um software em desenvolvimento. Recursos fiscais, trabalhistas, sanitários, financeiros ou regulatórios não substituem validação contábil, jurídica ou técnica especializada.

A utilização em produção deve ocorrer somente após homologação do ambiente, revisão de segurança, configuração adequada de credenciais, validação dos backups e aprovação dos critérios de liberação comercial.
