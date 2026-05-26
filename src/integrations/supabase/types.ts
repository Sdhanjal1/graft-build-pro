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
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          file_url: string
          id: string
          kind: string
          portal_visible: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          file_url: string
          id?: string
          kind?: string
          portal_visible?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          file_url?: string
          id?: string
          kind?: string
          portal_visible?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_portal_messages: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          read_at: string | null
          sender: string
          user_id: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender: string
          user_id: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          portal_active: boolean
          portal_code: string | null
          portal_issued_at: string
          property_type: string | null
          reminder_last_sent_at: string | null
          service_due_date: string | null
          service_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          portal_active?: boolean
          portal_code?: string | null
          portal_issued_at?: string
          property_type?: string | null
          reminder_last_sent_at?: string | null
          service_due_date?: string | null
          service_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          portal_active?: boolean
          portal_code?: string | null
          portal_issued_at?: string
          property_type?: string | null
          reminder_last_sent_at?: string | null
          service_due_date?: string | null
          service_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_email: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          quote_id: string
          request_type: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          quote_id: string
          request_type?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          quote_id?: string
          request_type?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_number: string | null
          account_paused_at: string | null
          accounting_codes: Json
          accounting_software: string | null
          bank_account_name: string | null
          bank_name: string | null
          business_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          payment_reference_note: string | null
          payment_terms: string | null
          phone: string | null
          quote_footer: string | null
          quote_intro: string | null
          registration_number: string | null
          show_signature: boolean
          signature_name: string | null
          sort_code: string | null
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean
          stripe_connect_payouts_enabled: boolean
          town: string | null
          trade_type: string | null
          trial_started_at: string | null
          updated_at: string
          vat_number: string | null
          vat_registered: boolean
        }
        Insert: {
          account_number?: string | null
          account_paused_at?: string | null
          accounting_codes?: Json
          accounting_software?: string | null
          bank_account_name?: string | null
          bank_name?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          logo_url?: string | null
          payment_reference_note?: string | null
          payment_terms?: string | null
          phone?: string | null
          quote_footer?: string | null
          quote_intro?: string | null
          registration_number?: string | null
          show_signature?: boolean
          signature_name?: string | null
          sort_code?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_payouts_enabled?: boolean
          town?: string | null
          trade_type?: string | null
          trial_started_at?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean
        }
        Update: {
          account_number?: string | null
          account_paused_at?: string | null
          accounting_codes?: Json
          accounting_software?: string | null
          bank_account_name?: string | null
          bank_name?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          payment_reference_note?: string | null
          payment_terms?: string | null
          phone?: string | null
          quote_footer?: string | null
          quote_intro?: string | null
          registration_number?: string | null
          show_signature?: boolean
          signature_name?: string | null
          sort_code?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_payouts_enabled?: boolean
          town?: string | null
          trade_type?: string | null
          trial_started_at?: string | null
          updated_at?: string
          vat_number?: string | null
          vat_registered?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quote_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          quote_id: string
          read_at: string | null
          sender: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          quote_id: string
          read_at?: string | null
          sender: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          quote_id?: string
          read_at?: string | null
          sender?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_portal_tokens: {
        Row: {
          channel: string
          created_at: string
          expires_at: string | null
          id: string
          quote_id: string
          token: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          quote_id: string
          token: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          quote_id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          body: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          customer_user_id: string
          id: string
          pro_user_id: string
          read_at: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id: string
          id?: string
          pro_user_id: string
          read_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string
          id?: string
          pro_user_id?: string
          read_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_due_date: string | null
          invoiced_at: string | null
          job_description: string | null
          line_items: Json
          notes: string | null
          paid_via: string | null
          payment_method: string | null
          payment_request: Json | null
          portal_visible: boolean
          ref: string | null
          status: string
          subtotal: number
          title: string
          total: number
          trade_type: string | null
          updated_at: string
          user_id: string
          vat_amount: number
          vat_registered: boolean
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_due_date?: string | null
          invoiced_at?: string | null
          job_description?: string | null
          line_items?: Json
          notes?: string | null
          paid_via?: string | null
          payment_method?: string | null
          payment_request?: Json | null
          portal_visible?: boolean
          ref?: string | null
          status?: string
          subtotal?: number
          title: string
          total?: number
          trade_type?: string | null
          updated_at?: string
          user_id: string
          vat_amount?: number
          vat_registered?: boolean
        }
        Update: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_due_date?: string | null
          invoiced_at?: string | null
          job_description?: string | null
          line_items?: Json
          notes?: string | null
          paid_via?: string | null
          payment_method?: string | null
          payment_request?: Json | null
          portal_visible?: boolean
          ref?: string | null
          status?: string
          subtotal?: number
          title?: string
          total?: number
          trade_type?: string | null
          updated_at?: string
          user_id?: string
          vat_amount?: number
          vat_registered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      site_capture_items: {
        Row: {
          capture_id: string
          created_at: string
          description: string
          id: string
          position: number
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capture_id: string
          created_at?: string
          description: string
          id?: string
          position?: number
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capture_id?: string
          created_at?: string
          description?: string
          id?: string
          position?: number
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_capture_items_capture_id_fkey"
            columns: ["capture_id"]
            isOneToOne: false
            referencedRelation: "site_captures"
            referencedColumns: ["id"]
          },
        ]
      }
      site_captures: {
        Row: {
          address: string | null
          created_at: string
          customer_name: string | null
          generated_quote_id: string | null
          id: string
          started_at: string
          status: string
          trade_type: string | null
          updated_at: string
          user_id: string
          vat_registered: boolean
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_name?: string | null
          generated_quote_id?: string | null
          id?: string
          started_at?: string
          status?: string
          trade_type?: string | null
          updated_at?: string
          user_id: string
          vat_registered?: boolean
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_name?: string | null
          generated_quote_id?: string | null
          id?: string
          started_at?: string
          status?: string
          trade_type?: string | null
          updated_at?: string
          user_id?: string
          vat_registered?: boolean
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          has_payment_method: boolean
          id: string
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string
          trial_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          has_payment_method?: boolean
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string
          trial_start?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          has_payment_method?: boolean
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string
          trial_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pricing_patterns: {
        Row: {
          created_at: string
          id: string
          item_category: string
          item_description: string
          last_quoted_at: string
          price_count: number
          price_max: number
          price_min: number
          typical_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_category?: string
          item_description: string
          last_quoted_at?: string
          price_count?: number
          price_max?: number
          price_min?: number
          typical_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_category?: string
          item_description?: string
          last_quoted_at?: string
          price_count?: number
          price_max?: number
          price_min?: number
          typical_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          auto_reply: string
          created_at: string
          dnd_enabled: boolean
          schedule: Json
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_reply?: string
          created_at?: string
          dnd_enabled?: boolean
          schedule?: Json
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_reply?: string
          created_at?: string
          dnd_enabled?: boolean
          schedule?: Json
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_portal_code: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
