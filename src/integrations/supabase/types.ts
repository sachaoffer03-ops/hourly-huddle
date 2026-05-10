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
      availabilities: {
        Row: {
          avail_date: string
          created_at: string
          id: string
          slot: Database["public"]["Enums"]["availability_slot"]
          user_id: string
        }
        Insert: {
          avail_date: string
          created_at?: string
          id?: string
          slot: Database["public"]["Enums"]["availability_slot"]
          user_id: string
        }
        Update: {
          avail_date?: string
          created_at?: string
          id?: string
          slot?: Database["public"]["Enums"]["availability_slot"]
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          app_role: Database["public"]["Enums"]["app_role"]
          business_roles: Database["public"]["Enums"]["business_role"][]
          contract: Database["public"]["Enums"]["contract_type"] | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          phone: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          studio_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          app_role?: Database["public"]["Enums"]["app_role"]
          business_roles?: Database["public"]["Enums"]["business_role"][]
          contract?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          first_name: string
          hire_date?: string | null
          id?: string
          last_name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          studio_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          app_role?: Database["public"]["Enums"]["app_role"]
          business_roles?: Database["public"]["Enums"]["business_role"][]
          contract?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          studio_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          contract: Database["public"]["Enums"]["contract_type"] | null
          created_at: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string
          hire_date: string | null
          iban: string | null
          id: string
          last_name: string
          nationality: string | null
          niss: string | null
          phone: string | null
          quota_max: number | null
          quota_used: number | null
          score: number | null
          status: Database["public"]["Enums"]["profile_status"]
          student_card_valid: boolean | null
          studio_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          contract?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          hire_date?: string | null
          iban?: string | null
          id: string
          last_name?: string
          nationality?: string | null
          niss?: string | null
          phone?: string | null
          quota_max?: number | null
          quota_used?: number | null
          score?: number | null
          status?: Database["public"]["Enums"]["profile_status"]
          student_card_valid?: boolean | null
          studio_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          contract?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          hire_date?: string | null
          iban?: string | null
          id?: string
          last_name?: string
          nationality?: string | null
          niss?: string | null
          phone?: string | null
          quota_max?: number | null
          quota_used?: number | null
          score?: number | null
          status?: Database["public"]["Enums"]["profile_status"]
          student_card_valid?: boolean | null
          studio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          business_role: Database["public"]["Enums"]["business_role"]
          created_at: string
          end_time: string
          id: string
          notes: string | null
          shift_date: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          studio_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_role: Database["public"]["Enums"]["business_role"]
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          shift_date: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          studio_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_role?: Database["public"]["Enums"]["business_role"]
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          shift_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          studio_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
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
      user_business_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      availability_slot: "matin" | "midi" | "soir"
      business_role: "Barista" | "Accueil" | "Host" | "Cuisine"
      contract_type: "Étudiant" | "Flexi" | "CDI"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      profile_status: "invited" | "active" | "suspended"
      shift_status: "scheduled" | "completed" | "cancelled" | "open"
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
      app_role: ["admin", "manager", "employee"],
      availability_slot: ["matin", "midi", "soir"],
      business_role: ["Barista", "Accueil", "Host", "Cuisine"],
      contract_type: ["Étudiant", "Flexi", "CDI"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      profile_status: ["invited", "active", "suspended"],
      shift_status: ["scheduled", "completed", "cancelled", "open"],
    },
  },
} as const
