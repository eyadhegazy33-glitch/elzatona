export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<
  Row,
  Insert,
  Update,
  Relationships extends Relationship[] = [],
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  email: string;
  requested_role_id: string | null;
  role_id: string | null;
  status: Database["public"]["Enums"]["account_status"];
  reject_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      roles: Table<
        {
          id: string;
          name: string;
          is_system: boolean;
          is_registrable: boolean;
          created_at: string;
        },
        {
          id?: string;
          name: string;
          is_system?: boolean;
          is_registrable?: boolean;
          created_at?: string;
        },
        {
          id?: string;
          name?: string;
          is_system?: boolean;
          is_registrable?: boolean;
          created_at?: string;
        }
      >;
      permissions: Table<
        { key: string; description: string | null },
        { key: string; description?: string | null },
        { key?: string; description?: string | null }
      >;
      role_permissions: Table<
        { role_id: string; permission_key: string },
        { role_id: string; permission_key: string },
        { role_id?: string; permission_key?: string },
        [
          {
            foreignKeyName: "role_permissions_permission_key_fkey";
            columns: ["permission_key"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ]
      >;
      profiles: Table<
        ProfileRow,
        {
          id: string;
          first_name: string;
          last_name: string;
          phone_number?: string | null;
          email: string;
          requested_role_id?: string | null;
          role_id?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          reject_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          first_name?: string;
          last_name?: string;
          phone_number?: string | null;
          email?: string;
          requested_role_id?: string | null;
          role_id?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          reject_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: "profiles_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_requested_role_id_fkey";
            columns: ["requested_role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ]
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          type: string;
          payload: Json;
          read_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          type: string;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string;
          type?: string;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        },
        [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      settings: Table<
        {
          key: string;
          value: Json;
          updated_by: string | null;
          updated_at: string;
        },
        {
          key: string;
          value: Json;
          updated_by?: string | null;
          updated_at?: string;
        },
        {
          key?: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: "settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      imports: Table<
        {
          id: string;
          user_id: string | null;
          created_by: string | null;
          filename: string | null;
          total: number;
          created: number;
          updated: number;
          skipped: number;
          failed: number;
          rolled_back_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id?: string | null;
          created_by?: string | null;
          filename?: string | null;
          total?: number;
          created?: number;
          updated?: number;
          skipped?: number;
          failed?: number;
          rolled_back_at?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          user_id?: string | null;
          created_by?: string | null;
          filename?: string | null;
          total?: number;
          created?: number;
          updated?: number;
          skipped?: number;
          failed?: number;
          rolled_back_at?: string | null;
          created_at?: string;
        },
        [
          {
            foreignKeyName: "imports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "imports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      student_types: Table<
        {
          id: string;
          name_en: string;
          name_ar: string;
          is_active: boolean;
          created_at: string;
        },
        {
          id?: string;
          name_en: string;
          name_ar: string;
          is_active?: boolean;
          created_at?: string;
        },
        {
          id?: string;
          name_en?: string;
          name_ar?: string;
          is_active?: boolean;
          created_at?: string;
        }
      >;
      customers: Table<
        {
          id: string;
          code: string;
          first_name: string;
          last_name: string;
          full_name: string;
          birth_date: string;
          student_type_id: string;
          phone: string | null;
          expiry_date: string | null;
          notes: string | null;
          status: Database["public"]["Enums"]["customer_status"];
          qr_token: string;
          import_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        },
        {
          id?: string;
          code?: string;
          first_name: string;
          last_name: string;
          full_name?: never;
          birth_date: string;
          student_type_id: string;
          phone?: string | null;
          expiry_date?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["customer_status"];
          qr_token?: string;
          import_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        },
        {
          id?: string;
          code?: string;
          first_name?: string;
          last_name?: string;
          full_name?: never;
          birth_date?: string;
          student_type_id?: string;
          phone?: string | null;
          expiry_date?: string | null;
          notes?: string | null;
          status?: Database["public"]["Enums"]["customer_status"];
          qr_token?: string;
          import_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        },
        [
          {
            foreignKeyName: "customers_student_type_id_fkey";
            columns: ["student_type_id"];
            isOneToOne: false;
            referencedRelation: "student_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
        ]
      >;
      checkins: Table<
        {
          id: number;
          customer_id: string;
          resource_id: string | null;
          checked_in_at: string;
          timer_started_at: string;
          last_qualifying_order_at: string | null;
          checked_out_at: string | null;
          scanned_by: string | null;
          created_by: string | null;
          closed_by: string | null;
        },
        {
          id?: never;
          customer_id: string;
          resource_id?: string | null;
          checked_in_at?: string;
          timer_started_at?: string;
          last_qualifying_order_at?: string | null;
          checked_out_at?: string | null;
          scanned_by?: string | null;
          created_by?: string | null;
          closed_by?: string | null;
        },
        {
          id?: never;
          customer_id?: string;
          resource_id?: string | null;
          checked_in_at?: string;
          timer_started_at?: string;
          last_qualifying_order_at?: string | null;
          checked_out_at?: string | null;
          scanned_by?: string | null;
          created_by?: string | null;
          closed_by?: string | null;
        },
        [
          {
            foreignKeyName: "checkins_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkins_scanned_by_fkey";
            columns: ["scanned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkins_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkins_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkins_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      pos_menu_categories: Table<
        {
          id: string;
          name_en: string;
          name_ar: string;
          sort: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          name_en: string;
          name_ar: string;
          sort?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          name_en?: string;
          name_ar?: string;
          sort?: number;
          active?: boolean;
          updated_at?: string;
        }
      >;
      pos_products: Table<
        {
          id: string;
          category_id: string | null;
          name_en: string;
          name_ar: string;
          description: string | null;
          price: number;
          qualifies_for_time: boolean;
          active: boolean;
          available: boolean;
          image_path: string | null;
          sort: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          category_id?: string | null;
          name_en: string;
          name_ar: string;
          description?: string | null;
          price: number;
          qualifies_for_time?: boolean;
          active?: boolean;
          available?: boolean;
          image_path?: string | null;
          sort?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          id?: string;
          category_id?: string | null;
          name_en?: string;
          name_ar?: string;
          description?: string | null;
          price?: number;
          qualifies_for_time?: boolean;
          active?: boolean;
          available?: boolean;
          image_path?: string | null;
          sort?: number;
          updated_at?: string;
        },
        [
          {
            foreignKeyName: "pos_products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "pos_menu_categories";
            referencedColumns: ["id"];
          },
        ]
      >;
      resources: Table<
        {
          id: string;
          type: "seat" | "room" | "table";
          name: string;
          capacity: number;
          status: "available" | "maintenance";
          active: boolean;
          created_at: string;
        },
        {
          id?: string;
          type: "seat" | "room" | "table";
          name: string;
          capacity?: number;
          status?: "available" | "maintenance";
          active?: boolean;
          created_at?: string;
        },
        {
          id?: string;
          type?: "seat" | "room" | "table";
          name?: string;
          capacity?: number;
          status?: "available" | "maintenance";
          active?: boolean;
          created_at?: string;
        }
      >;
      scan_logs: Table<
        {
          id: number;
          created_at: string;
          user_id: string | null;
          customer_id: string | null;
          input_hint: string | null;
          result: "ok" | "blocked" | "expired" | "unknown";
        },
        {
          id?: never;
          created_at?: string;
          user_id?: string | null;
          customer_id?: string | null;
          input_hint?: string | null;
          result: "ok" | "blocked" | "expired" | "unknown";
        },
        {
          id?: never;
          created_at?: string;
          user_id?: string | null;
          customer_id?: string | null;
          input_hint?: string | null;
          result?: "ok" | "blocked" | "expired" | "unknown";
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      update_setting: {
        Args: { p_key: string; p_value: Json };
        Returns: undefined;
      };
      create_role: {
        Args: { p_name: string; p_is_registrable: boolean };
        Returns: string;
      };
      rename_role: {
        Args: { p_role: string; p_name: string };
        Returns: undefined;
      };
      delete_role: {
        Args: { p_role: string };
        Returns: undefined;
      };
      set_role_permissions: {
        Args: { p_role: string; p_permissions: string[] };
        Returns: undefined;
      };
      set_role_registrable: {
        Args: { p_role: string; p_is_registrable: boolean };
        Returns: undefined;
      };
      approve_account: {
        Args: { p_user: string; p_role: string };
        Returns: undefined;
      };
      reject_account: {
        Args: { p_user: string; p_reason: string };
        Returns: undefined;
      };
      has_permission: {
        Args: { p_key: string };
        Returns: boolean;
      };
      get_my_access: {
        Args: Record<string, never>;
        Returns: Json;
      };
      update_employee: {
        Args: {
          p_user: string;
          p_first_name: string;
          p_last_name: string;
          p_role: string;
        };
        Returns: undefined;
      };
      set_employee_status: {
        Args: {
          p_user: string;
          p_status: Database["public"]["Enums"]["account_status"];
        };
        Returns: undefined;
      };
      soft_delete_employee: {
        Args: { p_user: string };
        Returns: undefined;
      };
      create_customer: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_birth_date: string;
          p_student_type_id: string;
          p_phone?: string | null;
          p_expiry_date?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      update_customer: {
        Args: {
          p_customer: string;
          p_first_name: string;
          p_last_name: string;
          p_birth_date: string;
          p_student_type_id: string;
          p_phone?: string | null;
          p_expiry_date?: string | null;
          p_notes?: string | null;
        };
        Returns: undefined;
      };
      set_customer_status: {
        Args: {
          p_customer: string;
          p_status: Database["public"]["Enums"]["customer_status"];
        };
        Returns: undefined;
      };
      soft_delete_customer: {
        Args: { p_customer: string };
        Returns: undefined;
      };
      reissue_qr_token: {
        Args: { p_customer: string };
        Returns: string;
      };
      get_customer_qr_token: {
        Args: { p_customer: string };
        Returns: string;
      };
      log_card_print: {
        Args: { p_count: number };
        Returns: undefined;
      };
      scan_customer: {
        Args: { p_input: string };
        Returns: Json;
      };
      check_in: {
        Args: { p_customer: string; p_resource?: string | null };
        Returns: Database["public"]["Tables"]["checkins"]["Row"];
      };
      check_out: {
        Args: { p_checkin: number };
        Returns: Json;
      };
      assign_customer_resource: {
        Args: { p_checkin: number; p_resource: string | null };
        Returns: Database["public"]["Tables"]["checkins"]["Row"];
      };
      get_resource_occupancy: {
        Args: Record<string, never>;
        Returns: { resource_id: string; people_inside: number }[];
      };
      import_customers: {
        Args: {
          p_rows: Json;
          p_filename: string;
          p_update_existing?: boolean;
        };
        Returns: {
          import_id: string;
          created: number;
          updated: number;
          skipped: number;
          failed: number;
        };
      };
      rollback_import: {
        Args: { p_import: string };
        Returns: number;
      };
      delete_resource: {
        Args: { p_resource: string };
        Returns: undefined;
      };
      get_pos_settings: {
        Args: Record<string, never>;
        Returns: Json;
      };
      update_pos_settings: {
        Args: {
          p_currency: string;
          p_visit_duration_minutes: number;
          p_fee_interval_minutes: number;
          p_fee_amount: number;
          p_timezone: string;
          p_tax_percent: number;
          p_service_percent: number;
          p_timer_warning_minutes: number;
          p_timer_grace_minutes: number;
          p_fee_repeats: boolean;
          p_timer_reset_on: string;
          p_require_open_shift: boolean;
          p_receipt_prefix: string;
          p_cash_diff_alert: number;
        };
        Returns: Json;
      };
      list_pos_categories: {
        Args: Record<string, never>;
        Returns: Json[];
      };
      save_pos_category: {
        Args: {
          p_id: string | null;
          p_name_en: string;
          p_name_ar: string;
          p_sort: number;
          p_active: boolean;
        };
        Returns: string;
      };
      list_pos_products: {
        Args: Record<string, never>;
        Returns: Json[];
      };
      save_pos_product: {
        Args: {
          p_id: string | null;
          p_name_en: string;
          p_name_ar: string;
          p_price: number;
          p_qualifies_for_time: boolean;
          p_active: boolean;
        };
        Returns: string;
      };
      save_pos_menu_item: {
        Args: {
          p_id: string | null;
          p_category_id: string;
          p_name_en: string;
          p_name_ar: string;
          p_description: string;
          p_price: number;
          p_counts_for_minimum: boolean;
          p_available: boolean;
          p_active: boolean;
          p_image_path: string | null;
          p_sort: number;
        };
        Returns: string;
      };
      get_current_pos_shift: {
        Args: Record<string, never>;
        Returns: Json;
      };
      open_pos_shift: {
        Args: { p_opening_cash: number };
        Returns: Json;
      };
      close_pos_shift: {
        Args: { p_shift: string; p_counted_cash: number };
        Returns: Json;
      };
      list_open_pos_visits: {
        Args: Record<string, never>;
        Returns: Json[];
      };
      get_visit_timer: {
        Args: { p_checkin: number };
        Returns: Json;
      };
      list_open_pos_orders: {
        Args: Record<string, never>;
        Returns: Json[];
      };
      create_pos_order: {
        Args: {
          p_customer: string;
          p_checkin: number;
          p_items: Json;
          p_discount_type?: string | null;
          p_discount_value?: number;
          p_discount_reason?: string | null;
        };
        Returns: Json;
      };
      create_order: {
        Args: {
          p_customer: string;
          p_items: Json;
          p_note?: string | null;
          p_discount?: number;
          p_discount_reason?: string | null;
        };
        Returns: Json;
      };
      search_order_customers: {
        Args: { p_query: string };
        Returns: Json[];
      };
      set_pos_order_status: {
        Args: { p_order: string; p_status: string };
        Returns: undefined;
      };
      set_order_status: {
        Args: { p_order: string; p_status: string };
        Returns: undefined;
      };
      list_order_board: {
        Args: Record<string, never>;
        Returns: Json[];
      };
      list_orders: {
        Args: {
          p_from?: string | null;
          p_to?: string | null;
          p_status?: string | null;
          p_search?: string | null;
          p_unpaid_only?: boolean;
        };
        Returns: Json[];
      };
      get_order_detail: {
        Args: { p_order: string };
        Returns: Json;
      };
      cancel_order: {
        Args: { p_order: string; p_reason: string };
        Returns: undefined;
      };
      complete_pos_order: {
        Args: { p_order: string; p_payment_method: string };
        Returns: Json;
      };
      cancel_pos_order: {
        Args: { p_order: string; p_reason: string };
        Returns: undefined;
      };
      void_pos_receipt: {
        Args: { p_receipt: string; p_reason: string };
        Returns: undefined;
      };
      list_pos_receipts: {
        Args: Record<string, never>;
        Returns: Json[];
      };
      list_visit_fees: {
        Args: Record<string, never>;
        Returns: Json[];
      };
      waive_visit_fee: {
        Args: { p_fee: string; p_reason: string };
        Returns: undefined;
      };
      pay_visit_fee: {
        Args: { p_fee: string; p_payment_method: string };
        Returns: Json;
      };
    };
    Enums: {
      account_status: "pending" | "active" | "rejected" | "suspended";
      customer_status: "active" | "blocked" | "expired";
    };
    CompositeTypes: Record<string, never>;
  };
};
