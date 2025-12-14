# Guia de Deploy no Vercel - Gestão App

## ✅ Problemas Resolvidos

### 1. **Dependências Downgradeadas**
- ✅ React: 19 → 18.2.0 (estável)
- ✅ Next.js: 15.3.8 → 14.2.0 (LTS)
- ✅ Tailwind CSS: v4 → v3.4.1 (estável)
- ✅ Todas as dependências para versões estáveis

### 2. **Configuração Corrigida**
- ✅ `tailwind.config.js` criado
- ✅ `postcss.config.mjs` configurado para Tailwind v3
- ✅ `vercel.json` criado com configurações otimizadas
- ✅ Nome do projeto alterado para evitar problemas no macOS

### 3. **Variáveis de Ambiente Necessárias**

No dashboard do Vercel, configure estas variáveis:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
```

## 🚀 Passos para Deploy

### 1. **Conectar Repositório**
```bash
# No Vercel Dashboard
# Conectar repositório do GitHub
```

### 2. **Configurar Variáveis**
```
Settings → Environment Variables
Adicionar as 3 variáveis listadas acima
```

### 3. **Deploy**
```
Deploy → Automatic (branch main)
ou Manual Deploy
```

### 4. **Verificar Build**
```
Functions → Build logs
Functions → Runtime logs
```

## ⚠️ Importante

### Variáveis de Ambiente
- `NEXT_PUBLIC_SUPABASE_URL` = URL do seu projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Chave pública (anon) do Supabase  
- `SUPABASE_SERVICE_ROLE_KEY` = Chave de serviço (privada)

### Database Schema
Execute o arquivo `database/schema.sql` no seu projeto Supabase antes do deploy.

## 🔧 Build de Teste Local

Para testar localmente:
```bash
npm run build
npm start
```

## 📊 Status do Projeto

- ✅ Dependências estabilizadas
- ✅ Configuração do Vercel pronta
- ✅ Build script configurado
- ⏳ Aguardando teste final
- ⏳ Deploy no Vercel
