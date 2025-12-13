# AI Coding Agent Instructions for Gestão 2.0

## Project Overview
Restaurant management system built with Next.js 15, TypeScript, Supabase, and Tailwind CSS. Features order management (Kanban), kitchen display system (KDS), inventory control, productivity tracking, technical sheets, and label printing.

## Architecture
- **Frontend**: Next.js 15 App Router with React 19, client/server components
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **UI**: shadcn/ui components on Radix UI primitives
- **Styling**: Tailwind CSS with responsive design (desktop/tablet/mobile)
- **Real-time**: Supabase Realtime for live updates (e.g., Kanban board changes), configured with eventsPerSecond: 10

## Key Patterns
- **Database Types**: Defined in `lib/supabase.ts` with Row/Insert/Update interfaces
- **Order Statuses**: 7 statuses in Portuguese: 'criado' → 'em_preparo' → 'separacao' → 'conferencia' → 'saiu_entrega' → 'entrega_concluida' | 'cancelado'
- **Permissions**: Role-based ('admin'/'user') with module-specific access ('pedidos', 'producao', 'estoque', 'inventario', 'fichas_tecnicas', 'etiquetas', 'compras', 'produtividade', 'admin', 'insumos')
- **Units**: Insumos use specific units ('kg', 'g', 'lt', 'ml', 'un', 'cx', 'pct')
- **Components**: Use `cn()` utility from `lib/utils.ts` for conditional classes
- **API Routes**: Dynamic routes like `/api/export/[tabela]` for data export in CSV/XLSX, `/api/import/[tabela]` for imports, `/api/print/[type]/[id]` for printing
- **Real-time Subscriptions**: `supabase.channel('table_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'table_name' }, callback).subscribe()`

## Development Workflow
- **Package Manager**: pnpm (install, dev, build, start)
- **Dev Server**: `pnpm dev` runs on port 3000
- **Database Setup**: Run `database/schema.sql` in Supabase project
- **Environment**: Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- **Build**: `pnpm build` for production
- **Import/Export**: Use `/api/export/[table]?formato=csv&dataInicio=...&dataFim=...` for exports, POST to `/api/import/[table]` with multipart/form-data for imports

## Conventions
- **Language**: Portuguese throughout (UI text, database fields, comments)
- **File Structure**: Pages in `src/app/(dashboard)/[module]/page.tsx`, components in `src/components/`, utilities in `src/lib/`
- **Naming**: Kebab-case for files (e.g., `fichas-tecnicas`), camelCase for variables
- **Icons**: Lucide React icons imported individually
- **Forms**: React Hook Form with @hookform/resolvers (zod) for validation
- **Currency**: Format with `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Printing**: Support thermal, PDF, HTML formats via ESC/POS commands for labels

## Common Tasks
- **Add New Module**: Create page in `src/app/(dashboard)/[module]/page.tsx`, add to Sidebar menuItems
- **Database Query**: Use `supabase.from('table').select()` with proper TypeScript types
- **Real-time Subscription**: `supabase.channel('table_changes').on('postgres_changes', ...).subscribe()`
- **Export Data**: Extend `/api/export/[tabela]` route with table-specific logic
- **Import Data**: Handle CSV/XLSX uploads in `/api/import/[tabela]` with validation
- **Printing**: Generate thermal commands or PDFs in `/api/print/[type]/[id]`
- **Permissions Check**: Compare user.role and module permissions before rendering features

## Examples
- **Kanban Status Config**: See `statusConfig` in `components/kanban/KanbanBoard.tsx`
- **Sidebar Menu**: See `menuItems` in `components/layout/Sidebar.tsx`
- **Database Insert**: `supabase.from('pedidos').insert({ estabelecimento_id, data_pedido, ... })`
- **Conditional Rendering**: `{user.role === 'admin' && <AdminPanel />}`
- **Responsive Layout**: `hidden md:flex` for desktop-only, `md:pl-64` for sidebar offset
- **Real-time Updates**: `supabase.channel('pedidos_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => { /* handle update */ }).subscribe()`</content>
<parameter name="filePath">/Users/ivanescobar/Downloads/Gestão.App/.github/copilot-instructions.md