# 🍞 Gestão 2.0 - Sistema Completo de Gestão para Restaurantes

Sistema web moderno e completo para gestão de restaurantes, padarias e estabelecimentos de produção alimentícia, desenvolvido com **Next.js 14**, **TypeScript**, **Supabase** e **Tailwind CSS**.

## 🌟 Funcionalidades Principais

### 📋 **Gestão de Pedidos (Kanban)**
- **Kanban visual** com 6 colunas de status
- **Atualizações em tempo real** via Supabase Realtime
- **Cálculo automático** de custos e prazos de entrega
- **Cards interativos** com progresso visual
- **Filtros avançados** por estabelecimento, status e período

### 👨‍🍳 **KDS - Kitchen Display System**
- **Monitor de cozinha** em tempo real
- **3 colunas**: Pendente → Em Preparo → Finalizado
- **Delegação de tarefas** para colaboradores
- **Controle de tempo** de preparo com progresso visual
- **Registro automático** de produtividade

### 📦 **Controle de Estoque**
- **Estoque atual** com alertas de mínimo/máximo
- **Sistema de inventário** completo (Iniciar/Encerrar contagem)
- **Controle de entradas** e perdas
- **Alertas visuais** para estoque crítico
- **Rastreabilidade** completa de movimentações

### 📊 **Produtividade e Ranking**
- **Ranking automático** de colaboradores
- **Métricas por período** (dia/semana/mês/ano)
- **3 colunas de análise**: Peso (kg), Unidades, Valor Total (R$)
- **Gráficos de performance** (estrutura preparada)
- **Relatórios exportáveis**

### 📝 **Ficha Técnica**
- **Cadastro completo** de receitas
- **Cálculo automático** de custos e CMV
- **Controle de ingredientes** com fatores de correção/cocção
- **Análise de rentabilidade** por receita
- **Gestão de rendimento** e porções

### 🏷️ **Sistema de Etiquetas**
- **2 tipos**: MANIPULAÇÃO e REVALIDAR
- **Impressão térmica** (comandos ESC/POS)
- **3 tamanhos** configuráveis
- **Histórico completo** de impressões
- **Rastreabilidade** de lotes e locais

### 📈 **Histórico e Análises**
- **Histórico completo** de pedidos
- **Análise de tendências** por estabelecimento
- **Base para ordens** de produção futuras
- **Insights automáticos** para planejamento
- **Integração preparada** para Power BI

### 📥📤 **Import/Export de Dados**
- **Importação CSV/XLSX** com validação
- **Exportação** em múltiplos formatos
- **Templates automáticos** para importação
- **Histórico** de operações
- **Validação de dados** em tempo real

### 👥 **Administração de Usuários**
- **Gestão completa** de usuários e cargos
- **Sistema de permissões** granular por módulo
- **Controle de acesso** baseado em roles
- **Auditoria** de acessos e ações
- **Reset de senhas** automático

## 🛠️ Tecnologias Utilizadas

### **Frontend**
- **Next.js 14** (App Router)
- **TypeScript** para type safety
- **Tailwind CSS** para styling
- **shadcn/ui** para componentes
- **Lucide React** para ícones

### **Backend**
- **Supabase** (PostgreSQL + Auth + Realtime + Storage)
- **Next.js API Routes** para endpoints customizados
- **Row Level Security (RLS)** para segurança

### **Funcionalidades Especiais**
- **Supabase Realtime** para atualizações em tempo real
- **Geração de PDF** para pedidos e relatórios
- **Impressão térmica** para etiquetas
- **Export/Import** CSV/XLSX
- **Responsive Design** (Desktop/Tablet/Mobile)

## 🗄️ Estrutura do Banco de Dados

### **Tabelas Principais**

#### **Autenticação e Usuários**
```sql
- profiles (perfis de usuário)
- cargos (funções dos colaboradores)
- colaboradores (dados dos funcionários)
- permissoes_modulo (permissões por módulo)
```

#### **Estabelecimentos e Produtos**
```sql
- estabelecimentos (clientes)
- insumos (produtos/matérias-primas)
- estoque_config (configuração min/max)
```

#### **Pedidos e Produção**
```sql
- pedidos (cabeçalho dos pedidos)
- pedido_itens (itens de cada pedido)
- producao (controle KDS)
- produtividade (métricas por colaborador)
```

#### **Estoque**
```sql
- estoque_atual (saldo atual)
- entradas (compras/produções)
- perdas (descartes)
- inventario + inventario_itens (contagens)
```

#### **Ficha Técnica**
```sql
- fichas_tecnicas (receitas)
- ficha_tecnica_itens (ingredientes)
```

#### **Etiquetas**
```sql
- tipos_etiqueta (MANIPULAÇÃO/REVALIDAR)
- config_tamanhos_etiqueta (tamanhos)
- etiquetas_geradas (histórico)
```

### **Views Úteis**
- `view_estoque_completo` - Estoque com alertas
- `view_produtividade_colaborador` - Métricas por colaborador
- `view_historico_pedidos` - Histórico completo

## 🚀 Como Executar

### **Pré-requisitos**
- Node.js 18+
- pnpm (recomendado)
- Conta no Supabase

### **Instalação**
```bash
# Clone o repositório
git clone [url-do-repositorio]
cd gestao-2.0

# Instale as dependências
pnpm install

# Configure as variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com suas credenciais do Supabase
```

### **Configuração do Supabase**
1. Crie um novo projeto no [Supabase](https://supabase.com)
2. Execute o script SQL em `database/schema.sql`
3. Configure as variáveis de ambiente:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **Executar em Desenvolvimento**
```bash
pnpm dev
```

### **Build para Produção**
```bash
pnpm build
pnpm start
```

## 📱 Responsividade

O sistema foi desenvolvido para funcionar perfeitamente em:
- **Desktop** (1920px+)
- **Tablet** (768px - 1919px)
- **Mobile** (320px - 767px)

## 🔐 Sistema de Permissões

### **Roles**
- **Admin**: Acesso total ao sistema
- **User**: Acesso baseado em permissões por módulo

### **Módulos**
- Pedidos, Produção, Estoque, Inventário
- Fichas Técnicas, Etiquetas, Compras
- Produtividade, Administração, Insumos

### **Cargos com Permissão para Editar Insumos**
- Chefe de Cozinha, Chefe de Produção
- Confeiteiro, Padeiro, Masseiro
- Burrateiro, Açougueiro
- Gestor, Diretor, Gerente, Proprietário

## 📊 APIs Disponíveis

### **Exportação**
```
GET /api/export/[tabela]?formato=csv&dataInicio=2024-01-01&dataFim=2024-01-31
```

### **Importação**
```
POST /api/import/[tabela]
Content-Type: multipart/form-data
Body: arquivo (CSV/XLSX)
```

### **Impressão de Pedidos**
```
GET /api/print/pedido/[id]?formato=pdf
GET /api/print/pedido/[id]?formato=html
```

### **Impressão de Etiquetas**
```
GET /api/print/etiqueta/[id]?formato=thermal
GET /api/print/etiqueta/[id]?formato=pdf
GET /api/print/etiqueta/[id]?formato=html
```

## 🖨️ Impressão Térmica

### **Etiquetas Suportadas**
- **MANIPULAÇÃO**: Dados básicos de manipulação
- **REVALIDAR**: Dados completos + informações do fabricante

### **Comandos ESC/POS**
O sistema gera comandos compatíveis com impressoras térmicas padrão:
- Formatação de texto (negrito, centralizado)
- Códigos de barras
- Corte automático de papel

### **Tamanhos Disponíveis**
- Pequena: 5cm × 3cm
- Média: 10cm × 6cm  
- Grande: 15cm × 10cm

## 📈 Integração com Power BI

### **String de Conexão**
```
Server=your-supabase-url;Database=postgres;User=your-user;Password=your-password
```

### **Views Recomendadas**
- `view_estoque_completo` - Análise de estoque
- `view_produtividade_colaborador` - Performance
- `view_historico_pedidos` - Tendências de vendas

## 🎯 Credenciais de Demo

Para testar o sistema:
- **URL**: https://sb-1q4kjmxh2kvm.vercel.run
- **Email**: admin@gestao2.com
- **Senha**: 123456

## 🔄 Fluxo de Trabalho

### **1. Criação de Pedido**
1. Selecionar estabelecimento
2. Adicionar itens (produto + quantidade)
3. Sistema calcula custo total automaticamente
4. Definir data de entrega baseada no prazo do estabelecimento
5. Pedido aparece no Kanban

### **2. Produção (KDS)**
1. Itens aparecem automaticamente no KDS
2. Colaborador inicia preparo
3. Sistema registra tempo e progresso
4. Ao finalizar, atualiza estoque e produtividade

### **3. Controle de Estoque**
1. Entradas aumentam estoque atual
2. Saídas (pedidos/perdas) diminuem estoque
3. Alertas automáticos para estoque mínimo
4. Inventário para ajustes e contagens

### **4. Análise e Relatórios**
1. Produtividade calculada automaticamente
2. Ranking atualizado em tempo real
3. Histórico para análise de tendências
4. Exportação para análises externas

## 🛡️ Segurança

- **Row Level Security (RLS)** no Supabase
- **Autenticação JWT** via Supabase Auth
- **Permissões granulares** por módulo
- **Validação de dados** em todas as APIs
- **Sanitização** de inputs do usuário

## 🚀 Deploy

### **Vercel (Recomendado)**
```bash
# Conecte seu repositório ao Vercel
# Configure as variáveis de ambiente
# Deploy automático a cada push
```

### **Outras Plataformas**
- Netlify
- Railway
- DigitalOcean App Platform

---

**Desenvolvido com ❤️ para revolucionar a gestão de restaurantes e estabelecimentos de produção alimentícia.**
# APP-Gestao-2.0-ALIFE
# APP-Gestao-2.0-ALIFE
