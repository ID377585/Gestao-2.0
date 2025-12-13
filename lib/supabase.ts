import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Tipos para o banco de dados
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          role: 'admin' | 'user'
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          role?: 'admin' | 'user'
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: 'admin' | 'user'
          ativo?: boolean
          updated_at?: string
        }
      }
      estabelecimentos: {
        Row: {
          id: number
          nome: string
          cnpj: string | null
          endereco: string | null
          telefone: string | null
          email: string | null
          prazo_entrega_dias: number
          tipo_estabelecimento: string | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          nome: string
          cnpj?: string | null
          endereco?: string | null
          telefone?: string | null
          email?: string | null
          prazo_entrega_dias?: number
          tipo_estabelecimento?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          nome?: string
          cnpj?: string | null
          endereco?: string | null
          telefone?: string | null
          email?: string | null
          prazo_entrega_dias?: number
          tipo_estabelecimento?: string | null
          ativo?: boolean
          updated_at?: string
        }
      }
      pedidos: {
        Row: {
          id: number
          estabelecimento_id: number
          data_pedido: string
          hora_pedido: string
          data_entrega_prevista: string
          data_entrega_real: string | null
          status: 'criado' | 'em_preparo' | 'separacao' | 'conferencia' | 'saiu_entrega' | 'entrega_concluida' | 'cancelado'
          valor_total_custo: number
          quem_criou: string
          created_at: string
          updated_at: string
        }
        Insert: {
          estabelecimento_id: number
          data_pedido: string
          hora_pedido: string
          data_entrega_prevista: string
          data_entrega_real?: string | null
          status?: 'criado' | 'em_preparo' | 'separacao' | 'conferencia' | 'saiu_entrega' | 'entrega_concluida' | 'cancelado'
          valor_total_custo: number
          quem_criou: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          estabelecimento_id?: number
          data_pedido?: string
          hora_pedido?: string
          data_entrega_prevista?: string
          data_entrega_real?: string | null
          status?: 'criado' | 'em_preparo' | 'separacao' | 'conferencia' | 'saiu_entrega' | 'entrega_concluida' | 'cancelado'
          valor_total_custo?: number
          quem_criou?: string
          updated_at?: string
        }
      }
    }
  }
}