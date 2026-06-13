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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      banks: {
        Row: {
          account_type: string | null
          color: string | null
          created_at: string
          id: string
          initial_balance: number
          logo_url: string | null
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          color?: string | null
          created_at?: string
          id?: string
          initial_balance?: number
          logo_url?: string | null
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          color?: string | null
          created_at?: string
          id?: string
          initial_balance?: number
          logo_url?: string | null
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          document_date: string | null
          document_type: string
          file_name: string | null
          file_path: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          organization_id: string
          related_recurring_id: string | null
          related_transaction_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          document_date?: string | null
          document_type: string
          file_name?: string | null
          file_path: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          organization_id: string
          related_recurring_id?: string | null
          related_transaction_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          document_date?: string | null
          document_type?: string
          file_name?: string | null
          file_path?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          related_recurring_id?: string | null
          related_transaction_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          brand_color: string | null
          client_status: string
          company: string | null
          created_at: string
          document: string | null
          email: string | null
          financial_status: string
          full_name: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          status: Database["public"]["Enums"]["client_status"]
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          client_status?: string
          company?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          financial_status?: string
          full_name?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          client_status?: string
          company?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          financial_status?: string
          full_name?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          classification: string
          created_at: string
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          classification?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          classification?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_occurrences: {
        Row: {
          amount: number
          bank_id: string | null
          created_at: string
          description: string
          due_date: string
          expense_plan_id: string
          financial_transaction_id: string | null
          id: string
          installment_number: number | null
          installments_total: number | null
          launched_at: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          provider_payable_id: string | null
          reference_month: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          created_at?: string
          description: string
          due_date: string
          expense_plan_id: string
          financial_transaction_id?: string | null
          id?: string
          installment_number?: number | null
          installments_total?: number | null
          launched_at?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          provider_payable_id?: string | null
          reference_month?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          expense_plan_id?: string
          financial_transaction_id?: string | null
          id?: string
          installment_number?: number | null
          installments_total?: number | null
          launched_at?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          provider_payable_id?: string | null
          reference_month?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_occurrences_expense_plan_id_fkey"
            columns: ["expense_plan_id"]
            isOneToOne: false
            referencedRelation: "expense_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_plans: {
        Row: {
          amount: number
          category_id: string | null
          client_id: string | null
          created_at: string
          default_bank_id: string | null
          description: string | null
          due_day: number | null
          end_date: string | null
          expense_type: string
          frequency: string | null
          id: string
          installments_count: number | null
          name: string
          notes: string | null
          organization_id: string
          recurrence_mode: string
          service_id: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          default_bank_id?: string | null
          description?: string | null
          due_day?: number | null
          end_date?: string | null
          expense_type: string
          frequency?: string | null
          id?: string
          installments_count?: number | null
          name: string
          notes?: string | null
          organization_id: string
          recurrence_mode?: string
          service_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          client_id?: string | null
          created_at?: string
          default_bank_id?: string | null
          description?: string | null
          due_day?: number | null
          end_date?: string | null
          expense_type?: string
          frequency?: string | null
          id?: string
          installments_count?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          recurrence_mode?: string
          service_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount_gross: number
          amount_net: number | null
          bank_id: string | null
          cashback_bank_id: string | null
          cashback_expected: number
          cashback_received: number
          cashback_received_at: string | null
          cashback_status: string
          category: string | null
          client_id: string | null
          created_at: string
          description: string
          due_date: string | null
          expense_occurrence_id: string | null
          fornecedor: string | null
          id: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          parent_transaction_id: string | null
          payment_method: string | null
          platform: string | null
          provider_payable_id: string | null
          recurring_contract_id: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          third_party_plan_id: string | null
          transfer_to_bank_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount_gross: number
          amount_net?: number | null
          bank_id?: string | null
          cashback_bank_id?: string | null
          cashback_expected?: number
          cashback_received?: number
          cashback_received_at?: string | null
          cashback_status?: string
          category?: string | null
          client_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          expense_occurrence_id?: string | null
          fornecedor?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          parent_transaction_id?: string | null
          payment_method?: string | null
          platform?: string | null
          provider_payable_id?: string | null
          recurring_contract_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          third_party_plan_id?: string | null
          transfer_to_bank_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount_gross?: number
          amount_net?: number | null
          bank_id?: string | null
          cashback_bank_id?: string | null
          cashback_expected?: number
          cashback_received?: number
          cashback_received_at?: string | null
          cashback_status?: string
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          expense_occurrence_id?: string | null
          fornecedor?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          parent_transaction_id?: string | null
          payment_method?: string | null
          platform?: string | null
          provider_payable_id?: string | null
          recurring_contract_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          third_party_plan_id?: string | null
          transfer_to_bank_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balance"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "financial_transactions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balance_breakdown"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_profitability_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_wallet"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "financial_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_recurring_contract_id_fkey"
            columns: ["recurring_contract_id"]
            isOneToOne: false
            referencedRelation: "recurring_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_profitability_summary"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "financial_transactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_summary"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "financial_transactions_transfer_to_bank_id_fkey"
            columns: ["transfer_to_bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_transfer_to_bank_id_fkey"
            columns: ["transfer_to_bank_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balance"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "financial_transactions_transfer_to_bank_id_fkey"
            columns: ["transfer_to_bank_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balance_breakdown"
            referencedColumns: ["bank_id"]
          },
        ]
      }
      organization_users: {
        Row: {
          created_at: string
          id: string
          member_role: Database["public"]["Enums"]["org_role"]
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_role?: Database["public"]["Enums"]["org_role"]
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_role?: Database["public"]["Enums"]["org_role"]
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string | null
          status: string
          subscription_ends_at: string | null
          subscription_start_at: string | null
          trial_ends_at: string | null
          trial_start_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug?: string | null
          status?: string
          subscription_ends_at?: string | null
          subscription_start_at?: string | null
          trial_ends_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string | null
          status?: string
          subscription_ends_at?: string | null
          subscription_start_at?: string | null
          trial_ends_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platforms: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      provider_assignments: {
        Row: {
          assignment_type: string
          auto_generate_payables: boolean
          client_id: string | null
          client_recurring_contract_id: string | null
          compensation_type: string
          created_at: string
          end_date: string | null
          first_due_date: string | null
          fixed_amount: number | null
          frequency: string | null
          id: string
          installments_count: number | null
          launch_behavior: string
          notes: string | null
          organization_id: string
          percentage: number | null
          provider_id: string
          recurrence_mode: string
          service_id: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          assignment_type: string
          auto_generate_payables?: boolean
          client_id?: string | null
          client_recurring_contract_id?: string | null
          compensation_type: string
          created_at?: string
          end_date?: string | null
          first_due_date?: string | null
          fixed_amount?: number | null
          frequency?: string | null
          id?: string
          installments_count?: number | null
          launch_behavior?: string
          notes?: string | null
          organization_id: string
          percentage?: number | null
          provider_id: string
          recurrence_mode?: string
          service_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_type?: string
          auto_generate_payables?: boolean
          client_id?: string | null
          client_recurring_contract_id?: string | null
          compensation_type?: string
          created_at?: string
          end_date?: string | null
          first_due_date?: string | null
          fixed_amount?: number | null
          frequency?: string | null
          id?: string
          installments_count?: number | null
          launch_behavior?: string
          notes?: string | null
          organization_id?: string
          percentage?: number | null
          provider_id?: string
          recurrence_mode?: string
          service_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_payables: {
        Row: {
          amount: number
          bank_id: string | null
          client_id: string | null
          created_at: string
          description: string
          due_date: string
          financial_transaction_id: string | null
          id: string
          installment_number: number | null
          installments_total: number | null
          launched_at: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          provider_assignment_id: string | null
          provider_id: string
          reference_month: string | null
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          client_id?: string | null
          created_at?: string
          description: string
          due_date: string
          financial_transaction_id?: string | null
          id?: string
          installment_number?: number | null
          installments_total?: number | null
          launched_at?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          provider_assignment_id?: string | null
          provider_id: string
          reference_month?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          financial_transaction_id?: string | null
          id?: string
          installment_number?: number | null
          installments_total?: number | null
          launched_at?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          provider_assignment_id?: string | null
          provider_id?: string
          reference_month?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          payment_notes: string | null
          phone: string | null
          pix_key: string | null
          provider_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          payment_notes?: string | null
          phone?: string | null
          pix_key?: string | null
          provider_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          payment_notes?: string | null
          phone?: string | null
          pix_key?: string | null
          provider_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_contracts: {
        Row: {
          amount: number
          anchor_day: number | null
          client_id: string
          created_at: string
          default_bank_id: string | null
          description: string | null
          frequency: Database["public"]["Enums"]["recurrence_freq"]
          id: string
          installments_generated: number
          installments_total: number | null
          next_due_date: string
          notes: string | null
          organization_id: string
          service_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          anchor_day?: number | null
          client_id: string
          created_at?: string
          default_bank_id?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_freq"]
          id?: string
          installments_generated?: number
          installments_total?: number | null
          next_due_date: string
          notes?: string | null
          organization_id: string
          service_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          anchor_day?: number | null
          client_id?: string
          created_at?: string
          default_bank_id?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_freq"]
          id?: string
          installments_generated?: number
          installments_total?: number | null
          next_due_date?: string
          notes?: string | null
          organization_id?: string
          service_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "recurring_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_profitability_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "recurring_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_wallet"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "recurring_contracts_default_bank_id_fkey"
            columns: ["default_bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_contracts_default_bank_id_fkey"
            columns: ["default_bank_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balance"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "recurring_contracts_default_bank_id_fkey"
            columns: ["default_bank_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balance_breakdown"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "recurring_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_contracts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_contracts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_profitability_summary"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "recurring_contracts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "v_service_summary"
            referencedColumns: ["service_id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          default_value: number | null
          description: string | null
          id: string
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["service_type"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_value?: number | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_value?: number | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      third_party_plans: {
        Row: {
          amount_paid_to_supplier: number
          amount_received_from_client: number
          bank_id: string | null
          cashback_expected: number
          cashback_received: number
          client_id: string
          commission_pct: number
          commission_value: number
          created_at: string
          fornecedor: string
          full_value: number | null
          id: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          period: string | null
          plan_name: string
          status: Database["public"]["Enums"]["plan_status"]
          updated_at: string
        }
        Insert: {
          amount_paid_to_supplier?: number
          amount_received_from_client?: number
          bank_id?: string | null
          cashback_expected?: number
          cashback_received?: number
          client_id: string
          commission_pct?: number
          commission_value?: number
          created_at?: string
          fornecedor: string
          full_value?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          period?: string | null
          plan_name: string
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
        }
        Update: {
          amount_paid_to_supplier?: number
          amount_received_from_client?: number
          bank_id?: string | null
          cashback_expected?: number
          cashback_received?: number
          client_id?: string
          commission_pct?: number
          commission_value?: number
          created_at?: string
          fornecedor?: string
          full_value?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          period?: string | null
          plan_name?: string
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_party_plans_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_plans_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balance"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "third_party_plans_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balance_breakdown"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "third_party_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "third_party_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "third_party_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_profitability_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "third_party_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_wallet"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "third_party_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_requests: {
        Row: {
          clients_estimate: string | null
          company_name: string
          created_at: string
          email: string
          id: string
          organization_id: string | null
          responsible_name: string
          segment: string | null
          whatsapp: string | null
        }
        Insert: {
          clients_estimate?: string | null
          company_name: string
          created_at?: string
          email: string
          id?: string
          organization_id?: string | null
          responsible_name: string
          segment?: string | null
          whatsapp?: string | null
        }
        Update: {
          clients_estimate?: string | null
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          organization_id?: string | null
          responsible_name?: string
          segment?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_global_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["global_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["global_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["global_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_bank_balance: {
        Row: {
          bank_id: string | null
          color: string | null
          current_balance: number | null
          name: string | null
          organization_id: string | null
        }
        Insert: {
          bank_id?: string | null
          color?: string | null
          current_balance?: never
          name?: string | null
          organization_id?: string | null
        }
        Update: {
          bank_id?: string | null
          color?: string | null
          current_balance?: never
          name?: string | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bank_balance_breakdown: {
        Row: {
          bank_id: string | null
          bank_name: string | null
          bank_type: string | null
          cashback_total: number | null
          color: string | null
          commission_total: number | null
          expense_total: number | null
          fees_total: number | null
          income_total: number | null
          initial_balance: number | null
          logo_url: string | null
          organization_id: string | null
          repasse_received_total: number | null
          repasse_used_total: number | null
          status: Database["public"]["Enums"]["entity_status"] | null
          transfer_in_total: number | null
          transfer_out_total: number | null
        }
        Insert: {
          bank_id?: string | null
          bank_name?: string | null
          bank_type?: string | null
          cashback_total?: never
          color?: string | null
          commission_total?: never
          expense_total?: never
          fees_total?: never
          income_total?: never
          initial_balance?: number | null
          logo_url?: string | null
          organization_id?: string | null
          repasse_received_total?: never
          repasse_used_total?: never
          status?: Database["public"]["Enums"]["entity_status"] | null
          transfer_in_total?: never
          transfer_out_total?: never
        }
        Update: {
          bank_id?: string | null
          bank_name?: string | null
          bank_type?: string | null
          cashback_total?: never
          color?: string | null
          commission_total?: never
          expense_total?: never
          fees_total?: never
          income_total?: never
          initial_balance?: number | null
          logo_url?: string | null
          organization_id?: string | null
          repasse_received_total?: never
          repasse_used_total?: never
          status?: Database["public"]["Enums"]["entity_status"] | null
          transfer_in_total?: never
          transfer_out_total?: never
        }
        Relationships: [
          {
            foreignKeyName: "banks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_client_financial_summary: {
        Row: {
          active_recurring_amount: number | null
          client_id: string | null
          client_net_profit: number | null
          expected_recurring_month: number | null
          organization_id: string | null
          pending_one_time_amount: number | null
          repasse_balance: number | null
          total_cashbacks: number | null
          total_commissions: number | null
          total_expenses: number | null
          total_fees: number | null
          total_overdue: number | null
          total_receivable: number | null
          total_received: number | null
          total_repasse_received: number | null
          total_repasse_used: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_client_profitability_summary: {
        Row: {
          cashback_received: number | null
          client_id: string | null
          expected_revenue: number | null
          fees_paid: number | null
          organization_id: string | null
          other_costs_paid: number | null
          paid_revenue: number | null
          provider_costs_expected: number | null
          provider_costs_paid: number | null
        }
        Insert: {
          cashback_received?: never
          client_id?: string | null
          expected_revenue?: never
          fees_paid?: never
          organization_id?: string | null
          other_costs_paid?: never
          paid_revenue?: never
          provider_costs_expected?: never
          provider_costs_paid?: never
        }
        Update: {
          cashback_received?: never
          client_id?: string | null
          expected_revenue?: never
          fees_paid?: never
          organization_id?: string | null
          other_costs_paid?: never
          paid_revenue?: never
          provider_costs_expected?: never
          provider_costs_paid?: never
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_client_wallet: {
        Row: {
          available_balance: number | null
          client_id: string | null
          client_name: string | null
          organization_id: string | null
          platform: string | null
          total_received: number | null
          total_used: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_provider_summary: {
        Row: {
          linked_clients_count: number | null
          linked_services_count: number | null
          organization_id: string | null
          overdue_amount: number | null
          paid_amount_period: number | null
          pending_amount: number | null
          provider_id: string | null
          provider_name: string | null
          provider_status: string | null
          provider_type: string | null
          recurring_monthly_cost: number | null
          total_paid: number | null
        }
        Insert: {
          linked_clients_count?: never
          linked_services_count?: never
          organization_id?: string | null
          overdue_amount?: never
          paid_amount_period?: never
          pending_amount?: never
          provider_id?: string | null
          provider_name?: string | null
          provider_status?: string | null
          provider_type?: string | null
          recurring_monthly_cost?: never
          total_paid?: never
        }
        Update: {
          linked_clients_count?: never
          linked_services_count?: never
          organization_id?: string | null
          overdue_amount?: never
          paid_amount_period?: never
          pending_amount?: never
          provider_id?: string | null
          provider_name?: string | null
          provider_status?: string | null
          provider_type?: string | null
          recurring_monthly_cost?: never
          total_paid?: never
        }
        Relationships: []
      }
      v_service_profitability_summary: {
        Row: {
          expected_revenue: number | null
          organization_id: string | null
          paid_revenue: number | null
          provider_costs_expected: number | null
          provider_costs_paid: number | null
          service_id: string | null
        }
        Insert: {
          expected_revenue?: never
          organization_id?: string | null
          paid_revenue?: never
          provider_costs_expected?: never
          provider_costs_paid?: never
          service_id?: string | null
        }
        Update: {
          expected_revenue?: never
          organization_id?: string | null
          paid_revenue?: never
          provider_costs_expected?: never
          provider_costs_paid?: never
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_service_summary: {
        Row: {
          active_clients_count: number | null
          active_mrr: number | null
          active_recurring_count: number | null
          average_ticket: number | null
          category: string | null
          default_value: number | null
          description: string | null
          inactive_clients_count: number | null
          organization_id: string | null
          overdue_amount: number | null
          paid_transactions_count: number | null
          pending_amount: number | null
          service_id: string | null
          service_name: string | null
          service_type: Database["public"]["Enums"]["service_type"] | null
          status: Database["public"]["Enums"]["entity_status"] | null
          total_clients_count: number | null
          total_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_org_active: { Args: { _org_id: string }; Returns: boolean }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      link_super_admin_by_email: {
        Args: { _email: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "financeiro"
        | "gerente"
        | "operacional"
        | "visualizador"
      client_status: "ativo" | "inativo" | "inadimplente"
      client_type: "PF" | "PJ"
      entity_status: "ativo" | "inativo" | "pausado" | "cancelado"
      global_role: "super_admin"
      org_role: "owner" | "manager" | "member"
      plan_status:
        | "pendente"
        | "recebido"
        | "pago_fornecedor"
        | "concluido"
        | "cancelado"
      recurrence_freq:
        | "semanal"
        | "quinzenal"
        | "mensal"
        | "trimestral"
        | "semestral"
        | "anual"
      service_type: "avulso" | "recorrente"
      transaction_status: "pendente" | "pago" | "atrasado" | "cancelado"
      transaction_type:
        | "receita_propria"
        | "despesa_propria"
        | "repasse_recebido"
        | "uso_repasse"
        | "comissao"
        | "cashback"
        | "taxa"
        | "transferencia"
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
        "admin",
        "financeiro",
        "gerente",
        "operacional",
        "visualizador",
      ],
      client_status: ["ativo", "inativo", "inadimplente"],
      client_type: ["PF", "PJ"],
      entity_status: ["ativo", "inativo", "pausado", "cancelado"],
      global_role: ["super_admin"],
      org_role: ["owner", "manager", "member"],
      plan_status: [
        "pendente",
        "recebido",
        "pago_fornecedor",
        "concluido",
        "cancelado",
      ],
      recurrence_freq: [
        "semanal",
        "quinzenal",
        "mensal",
        "trimestral",
        "semestral",
        "anual",
      ],
      service_type: ["avulso", "recorrente"],
      transaction_status: ["pendente", "pago", "atrasado", "cancelado"],
      transaction_type: [
        "receita_propria",
        "despesa_propria",
        "repasse_recebido",
        "uso_repasse",
        "comissao",
        "cashback",
        "taxa",
        "transferencia",
      ],
    },
  },
} as const
