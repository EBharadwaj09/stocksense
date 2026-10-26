// Generated from the Supabase schema (Supabase connector: generate_typescript_types).
// Regenerate after every migration; do not edit by hand.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      forecast_runs: {
        Row: {
          first_day: string;
          generated_at: string;
          history_days: number;
          horizon_days: number;
          model: string;
          note: string | null;
          products: number;
          shop_id: string;
        };
        Insert: {
          first_day: string;
          generated_at?: string;
          history_days?: number;
          horizon_days: number;
          model: string;
          note?: string | null;
          products?: number;
          shop_id: string;
        };
        Update: {
          first_day?: string;
          generated_at?: string;
          history_days?: number;
          horizon_days?: number;
          model?: string;
          note?: string | null;
          products?: number;
          shop_id?: string;
        };
        Relationships: [];
      };
      forecasts: {
        Row: {
          day: string;
          generated_at: string;
          product_id: string;
          quantity: number;
          shop_id: string;
        };
        Insert: {
          day: string;
          generated_at?: string;
          product_id: string;
          quantity: number;
          shop_id: string;
        };
        Update: {
          day?: string;
          generated_at?: string;
          product_id?: string;
          quantity?: number;
          shop_id?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          active: boolean;
          cost: number | null;
          created_at: string;
          id: string;
          lead_time_days: number;
          name: string;
          price: number | null;
          reorder_point: number;
          shop_id: string;
          sku: string | null;
          unit: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          cost?: number | null;
          created_at?: string;
          id?: string;
          lead_time_days?: number;
          name: string;
          price?: number | null;
          reorder_point?: number;
          shop_id: string;
          sku?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          cost?: number | null;
          created_at?: string;
          id?: string;
          lead_time_days?: number;
          name?: string;
          price?: number | null;
          reorder_point?: number;
          shop_id?: string;
          sku?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: number;
          product_id: string;
          quantity: number;
          shop_id: string;
          sold_at: string;
          source: string;
          unit_price: number | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: never;
          product_id: string;
          quantity: number;
          shop_id: string;
          sold_at?: string;
          source?: string;
          unit_price?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: never;
          product_id?: string;
          quantity?: number;
          shop_id?: string;
          sold_at?: string;
          source?: string;
          unit_price?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_product_id_shop_id_fkey";
            columns: ["product_id", "shop_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "shop_id"];
          },
          {
            foreignKeyName: "sales_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          id: string;
          invited_by: string;
          role: Database["public"]["Enums"]["shop_role"];
          shop_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          invited_by?: string;
          role?: Database["public"]["Enums"]["shop_role"];
          shop_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          invited_by?: string;
          role?: Database["public"]["Enums"]["shop_role"];
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_invites_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_members: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          role: Database["public"]["Enums"]["shop_role"];
          shop_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          role: Database["public"]["Enums"]["shop_role"];
          shop_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          role?: Database["public"]["Enums"]["shop_role"];
          shop_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shops: {
        Row: {
          created_at: string;
          created_by: string;
          currency: string;
          id: string;
          name: string;
          timezone: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          name: string;
          timezone?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: number;
          note: string | null;
          occurred_at: string;
          product_id: string;
          quantity: number;
          reason: string;
          sale_id: number | null;
          shop_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: never;
          note?: string | null;
          occurred_at?: string;
          product_id: string;
          quantity: number;
          reason: string;
          sale_id?: number | null;
          shop_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: never;
          note?: string | null;
          occurred_at?: string;
          product_id?: string;
          quantity?: number;
          reason?: string;
          sale_id?: number | null;
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_shop_id_fkey";
            columns: ["product_id", "shop_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "shop_id"];
          },
          {
            foreignKeyName: "stock_movements_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      daily_sales: {
        Row: {
          day: string | null;
          lines: number | null;
          product_id: string | null;
          quantity: number | null;
          revenue: number | null;
          shop_id: string | null;
        };
        Relationships: [];
      };
      product_stock: {
        Row: {
          on_hand: number | null;
          product_id: string | null;
          shop_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_invite: { Args: { p_invite: string }; Returns: string };
      create_shop: { Args: { p_name: string }; Returns: string };
      import_sales: {
        Args: { p_create_missing?: boolean; p_rows: Json; p_shop: string };
        Returns: Json;
      };
      record_sale: {
        Args: {
          p_product: string;
          p_quantity: number;
          p_sold_at?: string;
          p_unit_price?: number;
        };
        Returns: number;
      };
    };
    Enums: {
      shop_role: "owner" | "staff";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type ShopRole = Database["public"]["Enums"]["shop_role"];
