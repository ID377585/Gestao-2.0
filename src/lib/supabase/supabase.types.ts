export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string
          establishment_id: string
          full_name: string
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          full_name: string
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          full_name?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      establishment_memberships: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_memberships_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          product_name: string
          qty: number
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id?: string | null
          product_name: string
          qty?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          discount: number
          freight: number
          id: string
          notes: string | null
          order_id: string
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount?: number
          freight?: number
          id?: string
          notes?: string | null
          order_id: string
          status?: string
          subtotal?: number
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount?: number
          freight?: number
          id?: string
          notes?: string | null
          order_id?: string
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          org_id: string | null
          role: string
          unit_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          org_id?: string | null
          role?: string
          unit_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          org_id?: string | null
          role?: string
          unit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      order_invoice_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          invoice_id: string
          line_total: number
          product_id: string
          quantity: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          line_total?: number
          product_id: string
          quantity: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "order_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      order_invoices: {
        Row: {
          created_at: string | null
          created_by: string | null
          discount: number
          finalized_at: string | null
          finalized_by: string | null
          id: string
          notes: string | null
          order_id: string
          shipping: number
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          discount?: number
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          shipping?: number
          status?: string
          subtotal?: number
          total?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          discount?: number
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          shipping?: number
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_name: string
          qty: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_name: string
          qty?: number
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_name?: string
          qty?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line_items: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_label: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_label?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_line_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_separation_sessions: {
        Row: {
          created_at: string | null
          finished_at: string | null
          finished_by: string | null
          id: string
          order_id: string
          started_at: string | null
          started_by: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          finished_at?: string | null
          finished_by?: string | null
          id?: string
          order_id: string
          started_at?: string | null
          started_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          finished_at?: string | null
          finished_by?: string | null
          id?: string
          order_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_separation_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          action: string
          client_label: string | null
          created_at: string
          created_by: string | null
          establishment_id: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          message: string | null
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
          visible_to_client: boolean
        }
        Insert: {
          action?: string
          client_label?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          message?: string | null
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
          visible_to_client?: boolean
        }
        Update: {
          action?: string
          client_label?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          message?: string | null
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_transitions: {
        Row: {
          enabled: boolean
          from_status: Database["public"]["Enums"]["order_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          enabled?: boolean
          from_status: Database["public"]["Enums"]["order_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          enabled?: boolean
          from_status?: Database["public"]["Enums"]["order_status"]
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: []
      }
      order_timeline: {
        Row: {
          client_label: string | null
          created_at: string
          created_by: string | null
          establishment_id: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          client_label?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          client_label?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          carrier: string | null
          created_at: string
          created_by: string
          customer_user_id: string
          delivered_at: string | null
          delivered_by: string | null
          establishment_id: string
          id: string
          notes: string | null
          order_number: number
          reopened_at: string | null
          reopened_by: string | null
          shipped_at: string | null
          shipped_by: string | null
          status: Database["public"]["Enums"]["order_status"]
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          carrier?: string | null
          created_at?: string
          created_by: string
          customer_user_id: string
          delivered_at?: string | null
          delivered_by?: string | null
          establishment_id: string
          id?: string
          notes?: string | null
          order_number?: never
          reopened_at?: string | null
          reopened_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string
          customer_user_id?: string
          delivered_at?: string | null
          delivered_by?: string | null
          establishment_id?: string
          id?: string
          notes?: string | null
          order_number?: never
          reopened_at?: string | null
          reopened_by?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_establishment_fk"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pre_invoice_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          pre_invoice_id: string
          product_id: string | null
          product_name: string
          qty: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          pre_invoice_id: string
          product_id?: string | null
          product_name: string
          qty?: number
          unit: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          pre_invoice_id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pre_invoice_items_pre_invoice_id_fkey"
            columns: ["pre_invoice_id"]
            isOneToOne: false
            referencedRelation: "pre_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          discount: number
          id: string
          notes: string | null
          order_id: string
          separation_session_id: string
          shipping: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          notes?: string | null
          order_id: string
          separation_session_id: string
          shipping?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          notes?: string | null
          order_id?: string
          separation_session_id?: string
          shipping?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_invoices_separation_session_id_fkey"
            columns: ["separation_session_id"]
            isOneToOne: false
            referencedRelation: "order_separation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          conversion_factor: number | null
          created_at: string
          created_by: string | null
          default_unit_label: string
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          category?: string | null
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          default_unit_label: string
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
        }
        Update: {
          category?: string | null
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          default_unit_label?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      order_timeline_view: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          created_by_role: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string | null
          message: string | null
          order_id: string | null
          to_status: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_order: { Args: { _order_id: string }; Returns: undefined }
      active_membership: {
        Args: never
        Returns: {
          establishment_id: string
          role: string
        }[]
      }
      advance_order: { Args: { p_order_id: string }; Returns: undefined }
      advance_order_status: {
        Args: {
          p_note?: string
          p_order_id: string
          p_to_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      can_deliver: { Args: never; Returns: boolean }
      can_faturar: { Args: never; Returns: boolean }
      can_ship: { Args: never; Returns: boolean }
      can_ship_and_deliver: { Args: never; Returns: boolean }
      can_transition: {
        Args: { p_from: string; p_role: string; p_to: string }
        Returns: boolean
      }
      cancel_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: undefined
      }
      create_invoice_from_separation: {
        Args: { _session_id: string }
        Returns: string
      }
      create_pre_invoice: { Args: { _order_id: string }; Returns: string }
      create_pre_invoice_from_separation: {
        Args: {
          _notes?: string
          _order_id: string
          _separation_session_id: string
        }
        Returns: string
      }
      current_role: { Args: never; Returns: string }
      finalize_faturamento: {
        Args: { _carrier?: string; _order_id: string; _tracking_code?: string }
        Returns: undefined
      }
      finish_order_separation: {
        Args: { _session_id: string; _status: string }
        Returns: undefined
      }
      get_active_membership: {
        Args: never
        Returns: {
          establishment_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_order_timeline: {
        Args: { _order_id: string }
        Returns: {
          created_at: string
          created_by: string
          created_by_name: string
          created_by_role: string
          from_status: Database["public"]["Enums"]["order_status"]
          id: string
          message: string
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      has_role_text: { Args: { _roles: string[] }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      mark_as_delivered: { Args: { _order_id: string }; Returns: undefined }
      mark_order_delivered: { Args: { _order_id: string }; Returns: undefined }
      my_role_in_establishment: {
        Args: { p_establishment_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      order_belongs_to_user: {
        Args: { _order_id: string; _uid: string }
        Returns: boolean
      }
      order_owner_column: { Args: never; Returns: string }
      order_status_label: {
        Args: { p_status: Database["public"]["Enums"]["order_status"] }
        Returns: string
      }
      reject_order: {
        Args: { _order_id: string; _reason?: string }
        Returns: undefined
      }
      reopen_order: {
        Args: { p_note?: string; p_order_id: string }
        Returns: undefined
      }
      scan_qr_for_separation: {
        Args: { _qr_code: string; _quantity: number; _session_id: string }
        Returns: undefined
      }
      send_order_to_transport: {
        Args: { _carrier: string; _order_id: string; _tracking_code?: string }
        Returns: undefined
      }
      send_to_transport: { Args: { _order_id: string }; Returns: undefined }
      set_order_status: {
        Args: {
          p_client_label?: string
          p_order_id: string
          p_to_status: Database["public"]["Enums"]["order_status"]
          p_visible_to_client?: boolean
        }
        Returns: undefined
      }
      start_faturamento: { Args: { _order_id: string }; Returns: undefined }
      start_order_separation: { Args: { _order_id: string }; Returns: string }
      start_preparo: { Args: { _order_id: string }; Returns: undefined }
      start_separacao: { Args: { _order_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "cliente"
        | "operacao"
        | "producao"
        | "estoque"
        | "fiscal"
        | "admin"
        | "entrega"
      order_status:
        | "pedido_criado"
        | "aceitou_pedido"
        | "em_preparo"
        | "em_separacao"
        | "em_faturamento"
        | "em_transporte"
        | "entregue"
        | "cancelado"
        | "reaberto"
        | "faturamento"
      user_role:
        | "cliente"
        | "operacao"
        | "lider"
        | "estoquista"
        | "fiscal"
        | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "cliente",
        "operacao",
        "producao",
        "estoque",
        "fiscal",
        "admin",
        "entrega",
      ],
      order_status: [
        "pedido_criado",
        "aceitou_pedido",
        "em_preparo",
        "em_separacao",
        "em_faturamento",
        "em_transporte",
        "entregue",
        "cancelado",
        "reaberto",
        "faturamento",
      ],
      user_role: [
        "cliente",
        "operacao",
        "lider",
        "estoquista",
        "fiscal",
        "admin",
      ],
    },
  },
} as const
