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

const port = url.port || '5432'
const host = url.hostname.toLowerCase()
const isSupavisor = host.endsWith('.pooler.supabase.com')
const isDirectSupabase = host.startsWith('db.') && host.endsWith('.supabase.co')

if (port === '6543') {
  fail('transaction pooler :6543 não é aceito para pg_dump; use Direct connection ou Session pooler :5432')
}

if (port !== '5432') {
  fail(`porta ${port} não é aceita para o backup lógico; use :5432`)
}

if (isSupavisor && expectedProjectRef) {
  const expectedUsername = `postgres.${expectedProjectRef}`
  if (decodeURIComponent(url.username) !== expectedUsername) {
    fail(`Session pooler deve usar o usuário postgres.<project-ref>; esperado ${expectedUsername}`)
  }
}

if (isDirectSupabase && expectedProjectRef) {
  const expectedHost = `db.${expectedProjectRef}.supabase.co`
  if (host !== expectedHost) {
    fail(`host Direct connection não corresponde ao projeto esperado ${expectedProjectRef}`)
  }
  if (decodeURIComponent(url.username) !== 'postgres') {
    fail('Direct connection deve usar o usuário postgres')
  }
}

const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase()
if (!['require', 'verify-ca', 'verify-full'].includes(sslmode)) {
  fail('SSL obrigatório: adicione sslmode=require (ou verify-ca/verify-full) à URL de backup')
}

if (!isSupavisor && !isDirectSupabase) {
  fail('host da origem não corresponde a Direct connection nem ao Supabase Session pooler esperado')
}

console.log(`[dr-preflight] Origem de backup aceita. modo=${isSupavisor ? 'session-pooler' : 'direct'} ssl=${sslmode} porta=${port}`)
