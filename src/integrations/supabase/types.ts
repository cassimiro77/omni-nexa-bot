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
      contacts: {
        Row: {
          awaiting_nps: boolean
          created_at: string
          email: string | null
          id: string
          last_message_at: string | null
          metadata: Json | null
          name: string | null
          origin: string | null
          phone: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          awaiting_nps?: boolean
          created_at?: string
          email?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          name?: string | null
          origin?: string | null
          phone?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          awaiting_nps?: boolean
          created_at?: string
          email?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          name?: string | null
          origin?: string | null
          phone?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          dispatched_at: string | null
          id: string
          payload: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          dispatched_at?: string | null
          id?: string
          payload?: Json | null
          type: string
        }
        Update: {
          created_at?: string
          dispatched_at?: string | null
          id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: []
      }
      funnel_runs: {
        Row: {
          contact_id: string
          created_at: string
          current_step: number
          funnel_id: string
          id: string
          last_error: string | null
          next_run_at: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          current_step?: number
          funnel_id: string
          id?: string
          last_error?: string | null
          next_run_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          current_step?: number
          funnel_id?: string
          id?: string
          last_error?: string | null
          next_run_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_runs_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          steps: Json
          triggers: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          steps?: Json
          triggers?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          steps?: Json
          triggers?: Json
          updated_at?: string
        }
        Relationships: []
      }
      handoff_queue: {
        Row: {
          alert_count: number
          assigned_at: string | null
          assigned_to: string | null
          contact_id: string
          created_at: string
          customer_notified_at: string | null
          escalated_at: string | null
          id: string
          last_alert_at: string | null
          last_operator_message_at: string | null
          requested_at: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["handoff_status"]
          updated_at: string
        }
        Insert: {
          alert_count?: number
          assigned_at?: string | null
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          customer_notified_at?: string | null
          escalated_at?: string | null
          id?: string
          last_alert_at?: string | null
          last_operator_message_at?: string | null
          requested_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["handoff_status"]
          updated_at?: string
        }
        Update: {
          alert_count?: number
          assigned_at?: string | null
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          customer_notified_at?: string | null
          escalated_at?: string | null
          id?: string
          last_alert_at?: string | null
          last_operator_message_at?: string | null
          requested_at?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["handoff_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoff_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          events: string[]
          id: string
          last_error: string | null
          last_status: string | null
          last_sync_at: string | null
          name: string
          provider: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          name: string
          provider: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          name?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          language: string
          meta_template_name: string | null
          name: string
          status: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          language?: string
          meta_template_name?: string | null
          name: string
          status?: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          language?: string
          meta_template_name?: string | null
          name?: string
          status?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      messages: {
        Row: {
          ai_used: boolean
          channel: string
          contact_id: string
          content: string
          created_at: string
          direction: string
          id: string
          metadata: Json | null
          wa_message_id: string | null
        }
        Insert: {
          ai_used?: boolean
          channel?: string
          contact_id: string
          content: string
          created_at?: string
          direction: string
          id?: string
          metadata?: Json | null
          wa_message_id?: string | null
        }
        Update: {
          ai_used?: boolean
          channel?: string
          contact_id?: string
          content?: string
          created_at?: string
          direction?: string
          id?: string
          metadata?: Json | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_responses: {
        Row: {
          comment: string | null
          contact_id: string
          created_at: string
          id: string
          score: number
        }
        Insert: {
          comment?: string | null
          contact_id: string
          created_at?: string
          id?: string
          score: number
        }
        Update: {
          comment?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          ai_system_prompt: string | null
          business_name: string | null
          handoff_alert_phone: string | null
          handoff_auto_return_min: number | null
          handoff_escalate_min: number
          handoff_reminder_interval_min: number
          handoff_supervisor_phone: string | null
          handoff_wait_customer_min: number
          id: number
          outbound_webhook_url: string | null
          reply_with_audio: boolean
          source_prompts: Json
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          ai_system_prompt?: string | null
          business_name?: string | null
          handoff_alert_phone?: string | null
          handoff_auto_return_min?: number | null
          handoff_escalate_min?: number
          handoff_reminder_interval_min?: number
          handoff_supervisor_phone?: string | null
          handoff_wait_customer_min?: number
          id?: number
          outbound_webhook_url?: string | null
          reply_with_audio?: boolean
          source_prompts?: Json
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          ai_system_prompt?: string | null
          business_name?: string | null
          handoff_alert_phone?: string | null
          handoff_auto_return_min?: number | null
          handoff_escalate_min?: number
          handoff_reminder_interval_min?: number
          handoff_supervisor_phone?: string | null
          handoff_wait_customer_min?: number
          id?: number
          outbound_webhook_url?: string | null
          reply_with_audio?: boolean
          source_prompts?: Json
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "operator"
      handoff_status: "waiting" | "in_service" | "resolved" | "abandoned"
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
      app_role: ["admin", "operator"],
      handoff_status: ["waiting", "in_service", "resolved", "abandoned"],
    },
  },
} as const
