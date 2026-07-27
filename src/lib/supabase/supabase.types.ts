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
      carriers: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      current_stock_backup: {
        Row: {
          establishment_id: string
          product_id: string
          qty_balance: number
          unit_label: string
        }
        Insert: {
          establishment_id: string
          product_id: string
          qty_balance?: number
          unit_label: string
        }
        Update: {
          establishment_id?: string
          product_id?: string
          qty_balance?: number
          unit_label?: string
        }
        Relationships: []
      }
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
      fiscal_certificates: {
        Row: {
          certificate_path: string
          cnpj: string
          created_at: string
          encrypted_password: string
          establishment_id: string
          expires_at: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          certificate_path: string
          cnpj: string
          created_at?: string
          encrypted_password: string
          establishment_id: string
          expires_at?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          certificate_path?: string
          cnpj?: string
          created_at?: string
          encrypted_password?: string
          establishment_id?: string
          expires_at?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_company_profiles: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string
          created_at: string | null
          endereco: string | null
          establishment_id: string
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          numero: string | null
          razao_social: string
          telefone: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
          created_at?: string | null
          endereco?: string | null
          establishment_id: string
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          created_at?: string | null
          endereco?: string | null
          establishment_id?: string
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fiscal_nfe_inbox: {
        Row: {
          chave_acesso: string
          created_at: string
          data_emissao: string | null
          establishment_id: string
          fornecedor_cnpj: string | null
          fornecedor_nome: string | null
          id: string
          imported_entry_id: string | null
          nsu: string | null
          numero: string | null
          serie: string | null
          status_manifestacao: string | null
          updated_at: string
          valor_total: number | null
          xml_path: string | null
        }
        Insert: {
          chave_acesso: string
          created_at?: string
          data_emissao?: string | null
          establishment_id: string
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          imported_entry_id?: string | null
          nsu?: string | null
          numero?: string | null
          serie?: string | null
          status_manifestacao?: string | null
          updated_at?: string
          valor_total?: number | null
          xml_path?: string | null
        }
        Update: {
          chave_acesso?: string
          created_at?: string
          data_emissao?: string | null
          establishment_id?: string
          fornecedor_cnpj?: string | null
          fornecedor_nome?: string | null
          id?: string
          imported_entry_id?: string | null
          nsu?: string | null
          numero?: string | null
          serie?: string | null
          status_manifestacao?: string | null
          updated_at?: string
          valor_total?: number | null
          xml_path?: string | null
        }
        Relationships: []
      }
      fiscal_nsu_control: {
        Row: {
          created_at: string | null
          establishment_id: string
          id: string
          ultimo_nsu: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          establishment_id: string
          id?: string
          ultimo_nsu?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          establishment_id?: string
          id?: string
          ultimo_nsu?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fiscal_product_mappings: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          normalized_key: string
          product_id: string
          supplier_document: string | null
          updated_at: string
          xml_code: string | null
          xml_description: string | null
          xml_ean: string | null
          xml_unit: string | null
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          normalized_key: string
          product_id: string
          supplier_document?: string | null
          updated_at?: string
          xml_code?: string | null
          xml_description?: string | null
          xml_ean?: string | null
          xml_unit?: string | null
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          normalized_key?: string
          product_id?: string
          supplier_document?: string | null
          updated_at?: string
          xml_code?: string | null
          xml_description?: string | null
          xml_ean?: string | null
          xml_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fiscal_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_pages: {
        Row: {
          classification: string
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          page_number: number
          parsed_data: Json
          raw_text: string
          status: string
          technical_sheet_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          classification: string
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          page_number: number
          parsed_data?: Json
          raw_text: string
          status?: string
          technical_sheet_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          classification?: string
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          page_number?: number
          parsed_data?: Json
          raw_text?: string
          status?: string
          technical_sheet_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_pages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          created_recipes: number
          detected_recipes: number
          errors: Json
          establishment_id: string | null
          file_name: string
          file_path: string
          file_size: number
          file_url: string
          id: string
          mime_type: string
          status: string
          total_pages: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_recipes?: number
          detected_recipes?: number
          errors?: Json
          establishment_id?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_url: string
          id?: string
          mime_type: string
          status?: string
          total_pages?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_recipes?: number
          detected_recipes?: number
          errors?: Json
          establishment_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_url?: string
          id?: string
          mime_type?: string
          status?: string
          total_pages?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      inventory_count_items: {
        Row: {
          counted_qty: number
          created_at: string
          current_stock_before: number | null
          diff_qty: number
          error_message: string | null
          id: string
          inventory_count_id: string
          product_id: string
          product_name: string | null
          status: string | null
          unit_label: string
        }
        Insert: {
          counted_qty: number
          created_at?: string
          current_stock_before?: number | null
          diff_qty: number
          error_message?: string | null
          id?: string
          inventory_count_id: string
          product_id: string
          product_name?: string | null
          status?: string | null
          unit_label: string
        }
        Update: {
          counted_qty?: number
          created_at?: string
          current_stock_before?: number | null
          diff_qty?: number
          error_message?: string | null
          id?: string
          inventory_count_id?: string
          product_id?: string
          product_name?: string | null
          status?: string | null
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_inventory_count_id_fkey"
            columns: ["inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          created_at: string
          created_by: string
          ended_at: string
          establishment_id: string
          finished_at: string | null
          id: string
          notes: string | null
          started_at: string
          total_items: number | null
          total_products: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          ended_at?: string
          establishment_id: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          total_items?: number | null
          total_products?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          ended_at?: string
          establishment_id?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          total_items?: number | null
          total_products?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          counted_quantity: number
          created_at: string
          id: string
          product_id: string
          session_id: string
          unit_label: string
        }
        Insert: {
          counted_quantity: number
          created_at?: string
          id?: string
          product_id: string
          session_id: string
          unit_label: string
        }
        Update: {
          counted_quantity?: number
          created_at?: string
          id?: string
          product_id?: string
          session_id?: string
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_labels: {
        Row: {
          batch_number: string | null
          created_at: string
          created_by: string | null
          establishment_id: string
          expiration_date: string | null
          id: string
          label_code: string
          last_action: string | null
          manufacturing_date: string | null
          movement_id: string | null
          notes: string | null
          order_id: string | null
          product_id: string | null
          qty: number
          qty_balance: number
          separated_at: string | null
          separated_by: string | null
          status: string
          storage_location: string | null
          unit_label: string
          used_qty: number
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id: string
          expiration_date?: string | null
          id?: string
          label_code: string
          last_action?: string | null
          manufacturing_date?: string | null
          movement_id?: string | null
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          qty: number
          qty_balance?: number
          separated_at?: string | null
          separated_by?: string | null
          status?: string
          storage_location?: string | null
          unit_label: string
          used_qty?: number
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          expiration_date?: string | null
          id?: string
          label_code?: string
          last_action?: string | null
          manufacturing_date?: string | null
          movement_id?: string | null
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
          qty?: number
          qty_balance?: number
          separated_at?: string | null
          separated_by?: string | null
          status?: string
          storage_location?: string | null
          unit_label?: string
          used_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_labels_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          details: Json | null
          direction: string
          establishment_id: string
          id: string
          inventory_count_id: string | null
          label_id: string | null
          location: string | null
          movement_type: string | null
          notes: string | null
          order_id: string | null
          product_id: string
          qty: number
          qty_delta: number | null
          reason: string | null
          unit_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: Json | null
          direction: string
          establishment_id: string
          id?: string
          inventory_count_id?: string | null
          label_id?: string | null
          location?: string | null
          movement_type?: string | null
          notes?: string | null
          order_id?: string | null
          product_id: string
          qty: number
          qty_delta?: number | null
          reason?: string | null
          unit_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: Json | null
          direction?: string
          establishment_id?: string
          id?: string
          inventory_count_id?: string | null
          label_id?: string | null
          location?: string | null
          movement_type?: string | null
          notes?: string | null
          order_id?: string | null
          product_id?: string
          qty?: number
          qty_delta?: number | null
          reason?: string | null
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_count_id_fkey"
            columns: ["inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "inventory_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sessions: {
        Row: {
          created_by: string
          establishment_id: string
          finished_at: string | null
          id: string
          notes: string | null
          started_at: string
          status: Database["public"]["Enums"]["inventory_status"]
        }
        Insert: {
          created_by: string
          establishment_id: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["inventory_status"]
        }
        Update: {
          created_by?: string
          establishment_id?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["inventory_status"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_sessions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_entries: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attachment_pdf_path: string | null
          attachment_pdf_url: string | null
          attachment_xml_path: string | null
          attachment_xml_url: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_snapshot: string | null
          created_at: string
          created_by: string
          entry_date: string
          establishment_id: string
          id: string
          imported_from_xml: boolean
          invoice_key: string | null
          invoice_number: string
          invoice_series: string | null
          issue_date: string
          notes: string | null
          status: string
          supplier_document: string | null
          supplier_name: string
          total_amount: number
          total_items_qty: number
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attachment_pdf_path?: string | null
          attachment_pdf_url?: string | null
          attachment_xml_path?: string | null
          attachment_xml_url?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_snapshot?: string | null
          created_at?: string
          created_by: string
          entry_date?: string
          establishment_id: string
          id?: string
          imported_from_xml?: boolean
          invoice_key?: string | null
          invoice_number: string
          invoice_series?: string | null
          issue_date: string
          notes?: string | null
          status: string
          supplier_document?: string | null
          supplier_name: string
          total_amount?: number
          total_items_qty?: number
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attachment_pdf_path?: string | null
          attachment_pdf_url?: string | null
          attachment_xml_path?: string | null
          attachment_xml_url?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_snapshot?: string | null
          created_at?: string
          created_by?: string
          entry_date?: string
          establishment_id?: string
          id?: string
          imported_from_xml?: boolean
          invoice_key?: string | null
          invoice_number?: string
          invoice_series?: string | null
          issue_date?: string
          notes?: string | null
          status?: string
          supplier_document?: string | null
          supplier_name?: string
          total_amount?: number
          total_items_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_entries_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_entry_drafts: {
        Row: {
          approval_status: string
          created_at: string
          created_by: string | null
          data: Json
          establishment_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          establishment_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          establishment_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_entry_items: {
        Row: {
          created_at: string
          id: string
          invoice_entry_id: string
          product_id: string
          product_name_snapshot: string
          quantity: number
          sort_order: number
          total_cost: number
          unit_cost: number
          unit_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_entry_id: string
          product_id: string
          product_name_snapshot: string
          quantity: number
          sort_order?: number
          total_cost: number
          unit_cost: number
          unit_label: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_entry_id?: string
          product_id?: string
          product_name_snapshot?: string
          quantity?: number
          sort_order?: number
          total_cost?: number
          unit_cost?: number
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_entry_items_invoice_entry_id_fkey"
            columns: ["invoice_entry_id"]
            isOneToOne: false
            referencedRelation: "invoice_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_entry_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "invoice_entry_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_entry_pending_items: {
        Row: {
          created_at: string
          id: string
          invoice_entry_id: string
          notes: string | null
          resolution_status: string
          resolved_product_id: string | null
          xml_code: string | null
          xml_description: string
          xml_quantity: number
          xml_total_cost: number
          xml_unit: string | null
          xml_unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_entry_id: string
          notes?: string | null
          resolution_status?: string
          resolved_product_id?: string | null
          xml_code?: string | null
          xml_description: string
          xml_quantity?: number
          xml_total_cost?: number
          xml_unit?: string | null
          xml_unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_entry_id?: string
          notes?: string | null
          resolution_status?: string
          resolved_product_id?: string | null
          xml_code?: string | null
          xml_description?: string
          xml_quantity?: number
          xml_total_cost?: number
          xml_unit?: string | null
          xml_unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_entry_pending_items_invoice_entry_id_fkey"
            columns: ["invoice_entry_id"]
            isOneToOne: false
            referencedRelation: "invoice_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_entry_pending_items_resolved_product_id_fkey"
            columns: ["resolved_product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "invoice_entry_pending_items_resolved_product_id_fkey"
            columns: ["resolved_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      losses: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          label_code: string | null
          label_id: string | null
          lot: string | null
          product_id: string
          product_name: string
          qrcode: string | null
          qty: number
          reason: string
          reason_detail: string | null
          sku: string
          stock_after: number | null
          stock_before: number | null
          unit_label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          label_code?: string | null
          label_id?: string | null
          lot?: string | null
          product_id: string
          product_name: string
          qrcode?: string | null
          qty: number
          reason: string
          reason_detail?: string | null
          sku: string
          stock_after?: number | null
          stock_before?: number | null
          unit_label: string
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          label_code?: string | null
          label_id?: string | null
          lot?: string | null
          product_id?: string
          product_name?: string
          qrcode?: string | null
          qty?: number
          reason?: string
          reason_detail?: string | null
          sku?: string
          stock_after?: number | null
          stock_before?: number | null
          unit_label?: string
          user_id?: string
        }
        Relationships: []
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
      notifications: {
        Row: {
          createdAt: string | null
          id: string
          message: string | null
          read: boolean | null
          title: string | null
          userId: string | null
        }
        Insert: {
          createdAt?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          title?: string | null
          userId?: string | null
        }
        Update: {
          createdAt?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          title?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      order_billing_drafts: {
        Row: {
          base_cost: number
          carrier_id: string | null
          created_at: string
          created_by: string
          establishment_id: string
          freight_value: number
          id: string
          items: Json
          markup_percent: number
          order_id: string
          subtotal: number
          total_value: number
          total_with_markup: number
          updated_at: string
        }
        Insert: {
          base_cost: number
          carrier_id?: string | null
          created_at?: string
          created_by: string
          establishment_id: string
          freight_value?: number
          id?: string
          items: Json
          markup_percent: number
          order_id: string
          subtotal?: number
          total_value: number
          total_with_markup?: number
          updated_at?: string
        }
        Update: {
          base_cost?: number
          carrier_id?: string | null
          created_at?: string
          created_by?: string
          establishment_id?: string
          freight_value?: number
          id?: string
          items?: Json
          markup_percent?: number
          order_id?: string
          subtotal?: number
          total_value?: number
          total_with_markup?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_billing_drafts_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_billing_drafts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_billing_drafts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          production_assigned_to: string | null
          production_missing_qty: number | null
          production_status: string | null
          qty: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_name: string
          production_assigned_to?: string | null
          production_missing_qty?: number | null
          production_status?: string | null
          qty?: number
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_name?: string
          production_assigned_to?: string | null
          production_missing_qty?: number | null
          production_status?: string | null
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
      order_items_labels: {
        Row: {
          created_at: string
          id: string
          label_id: string
          order_id: string
          order_item_id: string | null
          qty_used: number
          unit_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          order_id: string
          order_item_id?: string | null
          qty_used: number
          unit_label: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          order_id?: string
          order_item_id?: string | null
          qty_used?: number
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "inventory_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_labels_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "order_items_labels_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
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
          production_assigned_to: string | null
          production_end_at: string | null
          production_missing_qty: number | null
          production_start_at: string | null
          production_status: string | null
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
          production_assigned_to?: string | null
          production_end_at?: string | null
          production_missing_qty?: number | null
          production_start_at?: string | null
          production_status?: string | null
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
          production_assigned_to?: string | null
          production_end_at?: string | null
          production_missing_qty?: number | null
          production_start_at?: string | null
          production_status?: string | null
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
          {
            foreignKeyName: "order_line_items_production_assigned_to_fkey"
            columns: ["production_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      production_productivity: {
        Row: {
          collaborator_id: string | null
          created_at: string | null
          duration_minutes: number | null
          finished_at: string | null
          id: string
          order_item_id: string | null
          order_item_id_alt: string | null
          product_id: string | null
          qty_produced: number
          started_at: string | null
          unit_label: string | null
        }
        Insert: {
          collaborator_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          order_item_id?: string | null
          order_item_id_alt?: string | null
          product_id?: string | null
          qty_produced: number
          started_at?: string | null
          unit_label?: string | null
        }
        Update: {
          collaborator_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          order_item_id?: string | null
          order_item_id_alt?: string | null
          product_id?: string | null
          qty_produced?: number
          started_at?: string | null
          unit_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_productivity_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_productivity_order_item_id_alt_fkey"
            columns: ["order_item_id_alt"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["order_item_id"]
          },
          {
            foreignKeyName: "production_productivity_order_item_id_alt_fkey"
            columns: ["order_item_id_alt"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_productivity_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_productivity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "production_productivity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          abc_curve: string | null
          aliases: string[] | null
          allergens: string[] | null
          alternate_names: string[] | null
          brand: string | null
          category: string | null
          conversion_factor: number | null
          created_at: string
          created_by: string | null
          default_unit_label: string
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          package_qty: number | null
          price: number
          product_type: string
          qty_per_package: string | null
          sector_category: string | null
          shelf_life_days: number | null
          sku: string | null
          standard_cost: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          abc_curve?: string | null
          aliases?: string[] | null
          allergens?: string[] | null
          alternate_names?: string[] | null
          brand?: string | null
          category?: string | null
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          default_unit_label: string
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          package_qty?: number | null
          price?: number
          product_type?: string
          qty_per_package?: string | null
          sector_category?: string | null
          shelf_life_days?: number | null
          sku?: string | null
          standard_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          abc_curve?: string | null
          aliases?: string[] | null
          allergens?: string[] | null
          alternate_names?: string[] | null
          brand?: string | null
          category?: string | null
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          default_unit_label?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          package_qty?: number | null
          price?: number
          product_type?: string
          qty_per_package?: string | null
          sector_category?: string | null
          shelf_life_days?: number | null
          sku?: string | null
          standard_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
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
          created_at: string | null
          full_name: string
          id: string
          role: string
          sector: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id: string
          role: string
          sector?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          role?: string
          sector?: string | null
        }
        Relationships: []
      }
      shipping_carriers: {
        Row: {
          address: string | null
          created_at: string
          delivery_temp_c: number | null
          email: string | null
          establishment_id: string
          has_refrigeration: boolean
          id: string
          initial_temp_c: number | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          delivery_temp_c?: number | null
          email?: string | null
          establishment_id: string
          has_refrigeration?: boolean
          id?: string
          initial_temp_c?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          delivery_temp_c?: number | null
          email?: string | null
          establishment_id?: string
          has_refrigeration?: boolean
          id?: string
          initial_temp_c?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_carriers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balance_audit: {
        Row: {
          created_at: string | null
          establishment_id: string
          id: string
          product_id: string
          qty_after: number | null
          qty_before: number | null
          qty_delta: number | null
          reason: string | null
          stock_balance_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          establishment_id: string
          id?: string
          product_id: string
          qty_after?: number | null
          qty_before?: number | null
          qty_delta?: number | null
          reason?: string | null
          stock_balance_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          establishment_id?: string
          id?: string
          product_id?: string
          qty_after?: number | null
          qty_before?: number | null
          qty_delta?: number | null
          reason?: string | null
          stock_balance_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stock_balances: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          location: string | null
          max_qty: number | null
          med_qty: number | null
          min_qty: number | null
          product_id: string
          quantity: number
          unit_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          location?: string | null
          max_qty?: number | null
          med_qty?: number | null
          min_qty?: number | null
          product_id: string
          quantity?: number
          unit_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          location?: string | null
          max_qty?: number | null
          med_qty?: number | null
          min_qty?: number | null
          product_id?: string
          quantity?: number
          unit_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_stock_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          establishment_id: string
          id: string
          product_id: string
          qty_delta: number
          reason: string
          source: string
          unit_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          establishment_id: string
          id?: string
          product_id: string
          qty_delta: number
          reason?: string
          source?: string
          unit_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          id?: string
          product_id?: string
          qty_delta?: number
          reason?: string
          source?: string
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_movements_establishment"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stock_movements_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_stock_movements_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          from_establishment_id: string
          id: string
          notes: string | null
          status: string
          to_establishment_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          from_establishment_id: string
          id?: string
          notes?: string | null
          status: string
          to_establishment_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          from_establishment_id?: string
          id?: string
          notes?: string | null
          status?: string
          to_establishment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_establishment_id_fkey"
            columns: ["from_establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_establishment_id_fkey"
            columns: ["to_establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cnpj: string | null
          complemento: string | null
          contato: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          telefone_2: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          telefone_2?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          telefone_2?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      technical_sheet_ingredients: {
        Row: {
          base_unit_cost: number
          cooking_factor: number
          correction_factor: number
          created_at: string
          final_cost: number
          id: string
          ingredient_name: string
          product_id: string | null
          purchase_price: number
          purchase_quantity: number
          purchase_unit: string
          sort_order: number
          technical_sheet_id: string
          usage_quantity: number
          usage_unit: string
        }
        Insert: {
          base_unit_cost?: number
          cooking_factor?: number
          correction_factor?: number
          created_at?: string
          final_cost?: number
          id?: string
          ingredient_name: string
          product_id?: string | null
          purchase_price?: number
          purchase_quantity?: number
          purchase_unit?: string
          sort_order?: number
          technical_sheet_id: string
          usage_quantity?: number
          usage_unit?: string
        }
        Update: {
          base_unit_cost?: number
          cooking_factor?: number
          correction_factor?: number
          created_at?: string
          final_cost?: number
          id?: string
          ingredient_name?: string
          product_id?: string | null
          purchase_price?: number
          purchase_quantity?: number
          purchase_unit?: string
          sort_order?: number
          technical_sheet_id?: string
          usage_quantity?: number
          usage_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "technical_sheet_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_sheet_ingredients_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheet_revision_logs: {
        Row: {
          action: string
          field_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_at: string
          performed_by: string
          reason: string | null
          revision_number: number
          technical_sheet_id: string
        }
        Insert: {
          action: string
          field_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          performed_by: string
          reason?: string | null
          revision_number: number
          technical_sheet_id: string
        }
        Update: {
          action?: string
          field_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string
          reason?: string | null
          revision_number?: number
          technical_sheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_revision_logs_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheet_scale_ingredients: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          ingredient_name: string
          scale_id: string
          sort_order: number
          technical_sheet_scale_id: string | null
          unit: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          ingredient_name: string
          scale_id: string
          sort_order?: number
          technical_sheet_scale_id?: string | null
          unit?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          ingredient_name?: string
          scale_id?: string
          sort_order?: number
          technical_sheet_scale_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_scale_ingredients_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "technical_sheet_scales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_sheet_scale_ingredients_technical_sheet_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "technical_sheet_scales"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheet_scales: {
        Row: {
          created_at: string
          id: string
          net_weight: number | null
          scale_label: string
          sort_order: number
          technical_sheet_id: string
          yield_description: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          net_weight?: number | null
          scale_label: string
          sort_order?: number
          technical_sheet_id: string
          yield_description?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          net_weight?: number | null
          scale_label?: string
          sort_order?: number
          technical_sheet_id?: string
          yield_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_scales_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheet_versions: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          change_summary: string | null
          created_at: string
          created_by: string
          establishment_id: string
          id: string
          revision_number: number
          snapshot_payload_json: Json
          snapshot_type: string
          technical_sheet_id: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          change_summary?: string | null
          created_at?: string
          created_by: string
          establishment_id: string
          id?: string
          revision_number: number
          snapshot_payload_json: Json
          snapshot_type?: string
          technical_sheet_id: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          change_summary?: string | null
          created_at?: string
          created_by?: string
          establishment_id?: string
          id?: string
          revision_number?: number
          snapshot_payload_json?: Json
          snapshot_type?: string
          technical_sheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheet_versions_technical_sheet_id_fkey"
            columns: ["technical_sheet_id"]
            isOneToOne: false
            referencedRelation: "technical_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_sheets: {
        Row: {
          active: boolean
          allergens: string | null
          category: string
          cooking_factor_grams: number | null
          cooking_time_minutes: number | null
          correction_factor_grams: number | null
          cost_per_portion: number
          created_at: string
          created_by: string | null
          current_approval_status: string
          current_revision_number: number
          difficulty_level: string | null
          establishment_id: string
          id: string
          image_path: string | null
          image_url: string | null
          import_origin: string | null
          is_linked_to_product: boolean
          last_approved_at: string | null
          last_approved_by: string | null
          last_approved_revision_number: number | null
          linked_product_id: string | null
          name: string
          portion_weight: number
          portion_weight_unit: string | null
          prep_time_minutes: number
          preparation_method: string | null
          profit_margin_percent: number
          sale_price: number
          sector: string | null
          shelf_life_frozen: string | null
          shelf_life_refrigerated: string | null
          shelf_life_room_temp: string | null
          source_file_name: string | null
          source_page_number: number | null
          source_updated_at: string | null
          storage_instructions: string | null
          temperature_celsius: number | null
          total_cost: number
          updated_at: string
          video_url: string | null
          yield_label: string | null
          yield_portions: number
        }
        Insert: {
          active?: boolean
          allergens?: string | null
          category: string
          cooking_factor_grams?: number | null
          cooking_time_minutes?: number | null
          correction_factor_grams?: number | null
          cost_per_portion?: number
          created_at?: string
          created_by?: string | null
          current_approval_status?: string
          current_revision_number?: number
          difficulty_level?: string | null
          establishment_id: string
          id?: string
          image_path?: string | null
          image_url?: string | null
          import_origin?: string | null
          is_linked_to_product?: boolean
          last_approved_at?: string | null
          last_approved_by?: string | null
          last_approved_revision_number?: number | null
          linked_product_id?: string | null
          name: string
          portion_weight?: number
          portion_weight_unit?: string | null
          prep_time_minutes?: number
          preparation_method?: string | null
          profit_margin_percent?: number
          sale_price?: number
          sector?: string | null
          shelf_life_frozen?: string | null
          shelf_life_refrigerated?: string | null
          shelf_life_room_temp?: string | null
          source_file_name?: string | null
          source_page_number?: number | null
          source_updated_at?: string | null
          storage_instructions?: string | null
          temperature_celsius?: number | null
          total_cost?: number
          updated_at?: string
          video_url?: string | null
          yield_label?: string | null
          yield_portions?: number
        }
        Update: {
          active?: boolean
          allergens?: string | null
          category?: string
          cooking_factor_grams?: number | null
          cooking_time_minutes?: number | null
          correction_factor_grams?: number | null
          cost_per_portion?: number
          created_at?: string
          created_by?: string | null
          current_approval_status?: string
          current_revision_number?: number
          difficulty_level?: string | null
          establishment_id?: string
          id?: string
          image_path?: string | null
          image_url?: string | null
          import_origin?: string | null
          is_linked_to_product?: boolean
          last_approved_at?: string | null
          last_approved_by?: string | null
          last_approved_revision_number?: number | null
          linked_product_id?: string | null
          name?: string
          portion_weight?: number
          portion_weight_unit?: string | null
          prep_time_minutes?: number
          preparation_method?: string | null
          profit_margin_percent?: number
          sale_price?: number
          sector?: string | null
          shelf_life_frozen?: string | null
          shelf_life_refrigerated?: string | null
          shelf_life_room_temp?: string | null
          source_file_name?: string | null
          source_page_number?: number | null
          source_updated_at?: string | null
          storage_instructions?: string | null
          temperature_celsius?: number | null
          total_cost?: number
          updated_at?: string
          video_url?: string | null
          yield_label?: string | null
          yield_portions?: number
        }
        Relationships: [
          {
            foreignKeyName: "technical_sheets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_sheets_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "technical_sheets_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      user_access_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          establishment_id: string
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          establishment_id: string
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          establishment_id?: string
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          browser_notifications: boolean
          created_at: string
          dark_mode: boolean
          email_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          browser_notifications?: boolean
          created_at?: string
          dark_mode?: boolean
          email_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          browser_notifications?: boolean
          created_at?: string
          dark_mode?: boolean
          email_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      current_stock: {
        Row: {
          establishment_id: string | null
          product_id: string | null
          qty_balance: number | null
          unit_label: string | null
        }
        Relationships: []
      }
      current_stock_view: {
        Row: {
          establishment_id: string | null
          product_id: string | null
          qty_balance: number | null
          unit_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_current: {
        Row: {
          product_name: string | null
          qty: number | null
        }
        Relationships: []
      }
      inventory_current_stock: {
        Row: {
          establishment_id: string | null
          product_id: string | null
          qty_balance: number | null
          unit_label: string | null
        }
        Insert: {
          establishment_id?: string | null
          product_id?: string | null
          qty_balance?: number | null
          unit_label?: string | null
        }
        Update: {
          establishment_id?: string | null
          product_id?: string | null
          qty_balance?: number | null
          unit_label?: string | null
        }
        Relationships: []
      }
      inventory_current_stock__deprecated: {
        Row: {
          current_stock: number | null
          establishment_id: string | null
          product_id: string | null
          product_name: string | null
          unit_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_last_count_vs_current: {
        Row: {
          counted_qty: number | null
          current_stock_before: number | null
          diff_qty: number | null
          establishment_id: string | null
          last_count_at: string | null
          product_id: string | null
          unit_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_production_view: {
        Row: {
          default_unit_label: string | null
          order_id: string | null
          order_item_id: string | null
          order_number: number | null
          order_qty: number | null
          order_status: Database["public"]["Enums"]["order_status"] | null
          product_id: string | null
          product_name: string | null
          production_assigned_to: string | null
          production_missing_qty: number | null
          production_status: string | null
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
      stocks: {
        Row: {
          created_at: string | null
          establishment_id: string | null
          id: string | null
          location: string | null
          max_qty: number | null
          med_qty: number | null
          min_qty: number | null
          product_id: string | null
          qty: number | null
          qty_balance: number | null
          quantity: number | null
          unit_label: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          establishment_id?: string | null
          id?: string | null
          location?: string | null
          max_qty?: number | null
          med_qty?: number | null
          min_qty?: number | null
          product_id?: string | null
          qty?: number | null
          qty_balance?: number | null
          quantity?: number | null
          unit_label?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          establishment_id?: string | null
          id?: string | null
          location?: string | null
          max_qty?: number | null
          med_qty?: number | null
          min_qty?: number | null
          product_id?: string | null
          qty?: number | null
          qty_balance?: number | null
          quantity?: number | null
          unit_label?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stock_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_stock_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kds_production_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      apply_production_and_update_stock: {
        Args: { p_order_item_id: string }
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
      consume_stock_from_order: {
        Args: { p_order_id: string }
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
      finalize_inventory_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      finalize_production: {
        Args: { p_order_item_id: string }
        Returns: undefined
      }
      finish_order_separation: {
        Args: { _session_id: string; _status: string }
        Returns: undefined
      }
      fn_upsert_stock_balance: {
        Args: {
          p_establishment_id: string
          p_product_id: string
          p_qty_delta: number
          p_unit_label: string
        }
        Returns: {
          id: string
          quantity: number
        }[]
      }
      fn_upsert_stock_balance_old: {
        Args: {
          p_establishment_id: string
          p_product_id: string
          p_qty_delta: number
          p_unit_label: string
        }
        Returns: {
          created_at: string
          establishment_id: string
          id: string
          location: string | null
          max_qty: number | null
          med_qty: number | null
          min_qty: number | null
          product_id: string
          quantity: number
          unit_label: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_balances"
          isOneToOne: true
          isSetofReturn: false
        }
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
      get_product_unit_label: {
        Args: { p_product_id: string }
        Returns: string
      }
      has_role_text: { Args: { _roles: string[] }; Returns: boolean }
      is_admin_in_establishment: { Args: { est: string }; Returns: boolean }
      is_establishment_member: {
        Args: { p_establishment_id: string }
        Returns: boolean
      }
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
      register_loss:
        | {
            Args: {
              p_establishment_id: string
              p_label_code?: string
              p_lot?: string
              p_product_id: string
              p_qty: number
              p_reason?: string
              p_reason_detail?: string
              p_unit_label: string
              p_user_id?: string
            }
            Returns: {
              establishment_id: string
              label_after: number
              label_before: number
              label_id: string
              loss_id: string
              stock_after: number
              stock_before: number
              user_id: string
            }[]
          }
        | {
            Args: {
              p_allow_negative?: boolean
              p_establishment_id: string
              p_label_code?: string
              p_lot?: string
              p_product_id: string
              p_qty: number
              p_reason?: string
              p_reason_detail?: string
              p_unit_label: string
              p_user_id?: string
            }
            Returns: {
              establishment_id: string
              label_after: number
              label_before: number
              label_id: string
              loss_id: string
              stock_after: number
              stock_before: number
              user_id: string
            }[]
          }
      reject_order: {
        Args: { _order_id: string; _reason?: string }
        Returns: undefined
      }
      reopen_order: {
        Args: { p_note?: string; p_order_id: string }
        Returns: undefined
      }
      resolve_product_unit_label: {
        Args: { p_product_id: string }
        Returns: string
      }
      run_inventory_report: {
        Args: never
        Returns: {
          counted_quantity: number
          difference: number
          item_id: string
          product_name: string
          status: string
          system_stock: number
          unit_label: string
        }[]
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
      separate_label_for_order: {
        Args: { p_label_code: string; p_order_id: string; p_user_id: string }
        Returns: {
          batch_number: string | null
          created_at: string
          created_by: string | null
          establishment_id: string
          expiration_date: string | null
          id: string
          label_code: string
          last_action: string | null
          manufacturing_date: string | null
          movement_id: string | null
          notes: string | null
          order_id: string | null
          product_id: string | null
          qty: number
          qty_balance: number
          separated_at: string | null
          separated_by: string | null
          status: string
          storage_location: string | null
          unit_label: string
          used_qty: number
        }[]
        SetofOptions: {
          from: "*"
          to: "inventory_labels"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_order_status: {
        Args: {
          p_client_label?: string
          p_order_id: string
          p_to_status: Database["public"]["Enums"]["order_status"]
          p_visible_to_client?: boolean
        }
        Returns: undefined
      }
      sql_run:
        | { Args: never; Returns: Json }
        | {
            Args: { p_sql: Json }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.sql_run(p_sql => text), public.sql_run(p_sql => jsonb). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { p_sql: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.sql_run(p_sql => text), public.sql_run(p_sql => jsonb). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
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
      inventory_status: "em_andamento" | "finalizado"
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
      inventory_status: ["em_andamento", "finalizado"],
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
