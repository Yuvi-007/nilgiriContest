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
    PostgrestVersion: "14.18"
  }
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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      audit_log: {
        Row: {
          action: string
          actor_login_id: string | null
          created_at: string
          details: Json
          id: string
        }
        Insert: {
          action: string
          actor_login_id?: string | null
          created_at?: string
          details?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_login_id?: string | null
          created_at?: string
          details?: Json
          id?: string
        }
        Relationships: []
      }
      coding_submissions: {
        Row: {
          contest_id: string
          created_at: string
          id: string
          language_id: number
          passed_tests: number
          question_id: string
          score: number
          source_code: string
          status: string
          stderr: string | null
          stdout: string | null
          total_tests: number
          user_id: string
        }
        Insert: {
          contest_id: string
          created_at?: string
          id?: string
          language_id: number
          passed_tests?: number
          question_id: string
          score?: number
          source_code: string
          status: string
          stderr?: string | null
          stdout?: string | null
          total_tests?: number
          user_id: string
        }
        Update: {
          contest_id?: string
          created_at?: string
          id?: string
          language_id?: number
          passed_tests?: number
          question_id?: string
          score?: number
          source_code?: string
          status?: string
          stderr?: string | null
          stdout?: string | null
          total_tests?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_submissions_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_submissions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_attempts: {
        Row: {
          answers: Json
          assigned_set: string
          contest_id: string
          extra_time_sec: number
          id: string
          last_seen_at: string
          score: number | null
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
          violation_events: Json
          violations: number
        }
        Insert: {
          answers?: Json
          assigned_set?: string
          contest_id: string
          extra_time_sec?: number
          id?: string
          last_seen_at?: string
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id: string
          violation_events?: Json
          violations?: number
        }
        Update: {
          answers?: Json
          assigned_set?: string
          contest_id?: string
          extra_time_sec?: number
          id?: string
          last_seen_at?: string
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id?: string
          violation_events?: Json
          violations?: number
        }
        Relationships: [
          {
            foreignKeyName: "contest_attempts_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_presence: {
        Row: {
          contest_id: string
          last_seen_at: string
          started_at: string
          status: string
          submitted_at: string | null
          user_id: string
          violations: number
        }
        Insert: {
          contest_id: string
          last_seen_at?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id: string
          violations?: number
        }
        Update: {
          contest_id?: string
          last_seen_at?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          user_id?: string
          violations?: number
        }
        Relationships: [
          {
            foreignKeyName: "contest_presence_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_questions: {
        Row: {
          contest_id: string
          position: number
          question_id: string
          set_code: string
        }
        Insert: {
          contest_id: string
          position: number
          question_id: string
          set_code?: string
        }
        Update: {
          contest_id?: string
          position?: number
          question_id?: string
          set_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_questions_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contest_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_results: {
        Row: {
          contest_id: string
          score: number
          submitted_at: string
          time_taken_seconds: number
          user_id: string
        }
        Insert: {
          contest_id: string
          score?: number
          submitted_at?: string
          time_taken_seconds?: number
          user_id: string
        }
        Update: {
          contest_id?: string
          score?: number
          submitted_at?: string
          time_taken_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_results_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_violations: {
        Row: {
          contest_id: string
          created_at: string
          details: Json
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          contest_id: string
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          contest_id?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_violations_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contests: {
        Row: {
          created_at: string
          description: string
          duration_minutes: number
          end_time: string
          id: string
          is_draft: boolean
          is_practice: boolean
          show_solutions_after_close: boolean
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_minutes?: number
          end_time: string
          id?: string
          is_draft?: boolean
          is_practice?: boolean
          show_solutions_after_close?: boolean
          start_time: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_minutes?: number
          end_time?: string
          id?: string
          is_draft?: boolean
          is_practice?: boolean
          show_solutions_after_close?: boolean
          start_time?: string
          title?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          failed_count: number
          locked_until: string | null
          login_id: string
          updated_at: string
        }
        Insert: {
          failed_count?: number
          locked_until?: string | null
          login_id: string
          updated_at?: string
        }
        Update: {
          failed_count?: number
          locked_until?: string | null
          login_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          login_id: string
          must_change_password: boolean
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          login_id: string
          must_change_password?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          login_id?: string
          must_change_password?: boolean
        }
        Relationships: []
      }
      questions: {
        Row: {
          body: string
          code_language: string
          correct_option: number | null
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty"] | null
          id: string
          image_url: string | null
          marks: number
          options: Json | null
          test_cases: Json
          title: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          body: string
          code_language?: string
          correct_option?: number | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          id?: string
          image_url?: string | null
          marks: number
          options?: Json | null
          test_cases?: Json
          title: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          body?: string
          code_language?: string
          correct_option?: number | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"] | null
          id?: string
          image_url?: string | null
          marks?: number
          options?: Json | null
          test_cases?: Json
          title?: string
          type?: Database["public"]["Enums"]["question_type"]
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
      admin_auto_generate_sets: { Args: { _contest_id: string }; Returns: Json }
      admin_clone_contest: { Args: { _source_id: string }; Returns: string }
      admin_contest_monitor: {
        Args: { _contest_id: string }
        Returns: {
          answers_completed: number
          assigned_set: string
          attempt_id: string
          deadline: string
          extra_time_sec: number
          full_name: string
          last_seen_at: string
          login_id: string
          started_at: string
          status: string
          submitted_at: string
          user_id: string
          violations: number
        }[]
      }
      admin_create_draft_contest: {
        Args: {
          _description: string
          _duration_minutes: number
          _end_time: string
          _is_practice?: boolean
          _start_time: string
          _title: string
        }
        Returns: string
      }
      admin_delete_question: {
        Args: { _question_id: string }
        Returns: boolean
      }
      admin_get_contest_questions: {
        Args: { _contest_id: string }
        Returns: {
          difficulty: Database["public"]["Enums"]["difficulty"]
          image_url: string
          marks: number
          position: number
          question_id: string
          set_code: string
          title: string
          type: Database["public"]["Enums"]["question_type"]
        }[]
      }
      admin_grant_extra_time: {
        Args: { _attempt_id: string; _minutes: number }
        Returns: boolean
      }
      admin_publish_contest: { Args: { _contest_id: string }; Returns: boolean }
      admin_reopen_submission: {
        Args: { _attempt_id: string; _minutes?: number }
        Returns: boolean
      }
      admin_set_contest_questions: {
        Args: {
          _contest_id: string
          _question_ids: string[]
          _set_code?: string
        }
        Returns: number
      }
      admin_terminate_attempt: {
        Args: { _attempt_id: string }
        Returns: boolean
      }
      admin_upsert_question: {
        Args: {
          _body?: string
          _code_language?: string
          _correct_option?: number
          _difficulty?: Database["public"]["Enums"]["difficulty"]
          _id?: string
          _image_url?: string
          _options?: Json
          _test_cases?: Json
          _title?: string
          _type?: Database["public"]["Enums"]["question_type"]
        }
        Returns: string
      }
      get_contest_attempt: { Args: { _contest_id: string }; Returns: Json }
      get_contest_questions: {
        Args: { _contest_id: string }
        Returns: {
          body: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          id: string
          image_url: string
          marks: number
          options: Json
          position: number
          set_code: string
          title: string
          type: Database["public"]["Enums"]["question_type"]
        }[]
      }
      get_homepage_snapshot: { Args: never; Returns: Json }
      get_student_attempt_status: {
        Args: { _contest_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_password_changed: { Args: never; Returns: undefined }
      next_contest_start: { Args: never; Returns: string }
      record_contest_violation: {
        Args: { _contest_id: string; _details?: Json; _event_type: string }
        Returns: number
      }
      save_attempt_answers: {
        Args: { _answers: Json; _attempt_id: string; _violations?: Json }
        Returns: Json
      }
      start_contest_attempt: { Args: { _contest_id: string }; Returns: string }
      start_contest_attempt_v2: { Args: { _contest_id: string }; Returns: Json }
      student_contest_heartbeat: {
        Args: { _contest_id: string; _status?: string; _violations?: number }
        Returns: boolean
      }
      submit_contest_attempt: {
        Args: { _answers: Json; _contest_id: string; _violations?: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "student"
      difficulty: "easy" | "medium" | "hard"
      question_type: "mcq" | "coding"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "student"],
      difficulty: ["easy", "medium", "hard"],
      question_type: ["mcq", "coding"],
    },
  },
} as const
