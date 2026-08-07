export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      checks: {
        Row: {
          advice: string;
          company_name: string | null;
          created_at: string;
          domain: string | null;
          domain_age_days: number | null;
          id: string;
          job_text: string;
          red_flags: Json;
          risk_level: string;
          risk_score: number;
          user_id: string;
          user_verification: string | null;
          verdict: string;
        };
        Insert: {
          advice: string;
          company_name?: string | null;
          created_at?: string;
          domain?: string | null;
          domain_age_days?: number | null;
          id?: string;
          job_text: string;
          red_flags?: Json;
          risk_level: string;
          risk_score: number;
          user_id: string;
          user_verification?: string | null;
          verdict: string;
        };
        Update: {
          advice?: string;
          company_name?: string | null;
          created_at?: string;
          domain?: string | null;
          domain_age_days?: number | null;
          id?: string;
          job_text?: string;
          red_flags?: Json;
          risk_level?: string;
          risk_score?: number;
          user_id?: string;
          user_verification?: string | null;
          verdict?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type CheckRow = Database["public"]["Tables"]["checks"]["Row"];
export type CheckInsert = Database["public"]["Tables"]["checks"]["Insert"];