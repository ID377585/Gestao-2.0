#!/usr/bin/env node

const rawUrl = process.env.SUPABASE_DB_URL || process.env.GESTIFY_DR_SOURCE_DB_URL
const expectedProjectRef = process.env.GESTIFY_DR_SOURCE_PROJECT_REF || ''

function fail(message) {
  console.error(`[dr-preflight] ERRO: ${message}`)
  process.exit(1)
}

if (!rawUrl) fail('URL do banco de origem ausente')

let url
try {
  url = new URL(rawUrl)
} catch {
  fail('URL do banco de origem inválida')
}

if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
  fail('a origem deve usar protocolo postgresql:// ou postgres://')
}

if (!url.hostname) fail('host do banco de origem ausente')
if (!url.username) fail('usuário do banco de origem ausente')
if (!url.password) fail('senha do banco de origem ausente')

const host = url.hostname.toLowerCase()
const isSupavisor = host.endsWith('.pooler.supabase.com')
const isDirectSupabase = host.startsWith('db.') && host.endsWith('.supabase.co')

if (!isSupavisor && !isDirectSupabase) {
  fail('host da origem não corresponde a Direct connection nem ao Supabase pooler esperado')
}

if (isSupavisor) {
  if (!expectedProjectRef) {
    fail('GESTIFY_DR_SOURCE_PROJECT_REF é obrigatório para normalizar conexão via Supavisor')
  }

  // A mesma credencial do banco funciona no Session pooler. Ajustamos apenas
  // roteamento/usuário em memória, sem alterar ou imprimir o secret original.
  url.port = '5432'
  url.username = `postgres.${expectedProjectRef}`
} else {
  url.port = '5432'
  if (expectedProjectRef) {
    const expectedHost = `db.${expectedProjectRef}.supabase.co`
    if (host !== expectedHost) {
      fail(`host Direct connection não corresponde ao projeto esperado ${expectedProjectRef}`)
    }
  }
}

const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase()
if (!['require', 'verify-ca', 'verify-full'].includes(sslmode)) {
  url.searchParams.set('sslmode', 'require')
}

const finalSslmode = url.searchParams.get('sslmode')
console.error(
  `[dr-preflight] Origem normalizada com segurança. modo=${isSupavisor ? 'session-pooler' : 'direct'} ssl=${finalSslmode} porta=5432`,
)

// stdout é reservado exclusivamente para consumo por command substitution.
// O chamador usa set +x e nunca imprime este valor.
process.stdout.write(url.toString())
