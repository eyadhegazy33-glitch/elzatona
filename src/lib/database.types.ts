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
    };
    Enums: {
      account_status: "pending" | "active" | "rejected" | "suspended";
    };
    CompositeTypes: Record<string, never>;
  };
};
