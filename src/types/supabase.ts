export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      channel_profiles: {
        Row: {
          analysis_date: string | null
          channel_id: string
          confidence_score: number | null
          created_at: string | null
          id: string
          language_style: Json
          political_stance: Json
          updated_at: string | null
        }
        Insert: {
          analysis_date?: string | null
          channel_id: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          language_style?: Json
          political_stance?: Json
          updated_at?: string | null
        }
        Update: {
          analysis_date?: string | null
          channel_id?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          language_style?: Json
          political_stance?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_profiles_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "news_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      event_templates: {
        Row: {
          channel_id: string
          created_at: string | null
          effectiveness_score: number | null
          event_category: string
          id: string
          language_template: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          effectiveness_score?: number | null
          event_category: string
          id?: string
          language_template: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          effectiveness_score?: number | null
          event_category?: string
          id?: string
          language_template?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_templates_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "news_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_content: {
        Row: {
          channel_id: string
          consistency_scores: Json
          content: string
          content_type: string | null
          created_at: string | null
          feedback: string | null
          generation_prompt: string | null
          generation_time_ms: number | null
          human_approved: boolean | null
          id: string
          model_used: string | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          consistency_scores?: Json
          content: string
          content_type?: string | null
          created_at?: string | null
          feedback?: string | null
          generation_prompt?: string | null
          generation_time_ms?: number | null
          human_approved?: boolean | null
          id?: string
          model_used?: string | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          consistency_scores?: Json
          content?: string
          content_type?: string | null
          created_at?: string | null
          feedback?: string | null
          generation_prompt?: string | null
          generation_time_ms?: number | null
          human_approved?: boolean | null
          id?: string
          model_used?: string | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_content_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "news_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          analysis_completed: boolean | null
          channel_id: string
          content: string
          created_at: string | null
          id: string
          migrated_at: string | null
          published_at: string | null
          source_metadata: Json | null
          summary: string | null
          title: string
          updated_at: string | null
          vector_id: string | null
        }
        Insert: {
          analysis_completed?: boolean | null
          channel_id: string
          content: string
          created_at?: string | null
          id?: string
          migrated_at?: string | null
          published_at?: string | null
          source_metadata?: Json | null
          summary?: string | null
          title: string
          updated_at?: string | null
          vector_id?: string | null
        }
        Update: {
          analysis_completed?: boolean | null
          channel_id?: string
          content?: string
          created_at?: string | null
          id?: string
          migrated_at?: string | null
          published_at?: string | null
          source_metadata?: Json | null
          summary?: string | null
          title?: string
          updated_at?: string | null
          vector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "news_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      news_channels: {
        Row: {
          analysis_status: string | null
          created_at: string | null
          id: string
          name: string
          source_db_config: Json
          updated_at: string | null
        }
        Insert: {
          analysis_status?: string | null
          created_at?: string | null
          id?: string
          name: string
          source_db_config?: Json
          updated_at?: string | null
        }
        Update: {
          analysis_status?: string | null
          created_at?: string | null
          id?: string
          name?: string
          source_db_config?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_similar_events: {
        Args: {
          search_channel_id: string
          event_category_input: string
          search_keywords: string[]
        }
        Returns: {
          id: string
          title: string
          content: string
          published_at: string
          similarity_score: number
        }[]
      }
      get_channel_stats: {
        Args: { channel_uuid: string }
        Returns: Json
      }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      update_channel_analysis_status: {
        Args: { channel_uuid: string; new_status: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

