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
            profile_photo_cleanup: {
                Row: {
                    owner_id: string
                    image_id: string
                    created_at: string
                }
                Insert: {
                    owner_id: string
                    image_id: string
                    created_at?: string
                }
                Update: {
                    owner_id?: string
                    image_id?: string
                    created_at?: string
                }
                Relationships: []
            }
            catalog_items: {
                Row: {
                    background_image_id: string | null
                    created_at: string
                    description: string
                    id: string
                    name: string
                    owner_id: string
                    profile_image_id: string | null
                    revision: number
                    updated_at: string
                }
                Insert: {
                    background_image_id?: string | null
                    created_at?: string
                    description?: string
                    id?: string
                    name: string
                    owner_id?: string
                    profile_image_id?: string | null
                    revision?: number
                    updated_at?: string
                }
                Update: {
                    background_image_id?: string | null
                    created_at?: string
                    description?: string
                    id?: string
                    name?: string
                    owner_id?: string
                    profile_image_id?: string | null
                    revision?: number
                    updated_at?: string
                }
                Relationships: []
            }
            ranking_entries: {
                Row: {
                    id: string
                    item_id: string
                    list_id: string
                    note: string
                    owner_id: string
                    position: number
                }
                Insert: {
                    id?: string
                    item_id: string
                    list_id: string
                    note?: string
                    owner_id?: string
                    position: number
                }
                Update: {
                    id?: string
                    item_id?: string
                    list_id?: string
                    note?: string
                    owner_id?: string
                    position?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "ranking_entries_owner_id_item_id_fkey"
                        columns: ["owner_id", "item_id"]
                        isOneToOne: false
                        referencedRelation: "catalog_items"
                        referencedColumns: ["owner_id", "id"]
                    },
                    {
                        foreignKeyName: "ranking_entries_owner_id_list_id_fkey"
                        columns: ["owner_id", "list_id"]
                        isOneToOne: false
                        referencedRelation: "ranking_lists"
                        referencedColumns: ["owner_id", "id"]
                    },
                ]
            }
            ranking_lists: {
                Row: {
                    accent_color: string | null
                    background_image_id: string | null
                    cover_image_id: string | null
                    created_at: string
                    description: string
                    id: string
                    owner_id: string
                    revision: number
                    sort_order: number
                    theme_id: string
                    title: string
                    updated_at: string
                }
                Insert: {
                    accent_color?: string | null
                    background_image_id?: string | null
                    cover_image_id?: string | null
                    created_at?: string
                    description?: string
                    id?: string
                    owner_id?: string
                    revision?: number
                    sort_order?: number
                    theme_id?: string
                    title: string
                    updated_at?: string
                }
                Update: {
                    accent_color?: string | null
                    background_image_id?: string | null
                    cover_image_id?: string | null
                    created_at?: string
                    description?: string
                    id?: string
                    owner_id?: string
                    revision?: number
                    sort_order?: number
                    theme_id?: string
                    title?: string
                    updated_at?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            delete_ranking_list: {
                Args: { p_expected_revision: number; p_id: string }
                Returns: undefined
            }
            reorder_ranking_lists: { Args: { p_lists: Json }; Returns: undefined }
            save_catalog_item: {
                Args: {
                    p_background_image_id?: string
                    p_description?: string
                    p_expected_revision?: number
                    p_id: string
                    p_name: string
                    p_profile_image_id?: string
                }
                Returns: {
                    background_image_id: string | null
                    created_at: string
                    description: string
                    id: string
                    name: string
                    owner_id: string
                    profile_image_id: string | null
                    revision: number
                    updated_at: string
                }[]
                SetofOptions: {
                    from: "*"
                    to: "catalog_items"
                    isOneToOne: false
                    isSetofReturn: true
                }
            }
            save_ranking_list: {
                Args: { p_entries: Json; p_expected_revision?: number; p_list: Json }
                Returns: {
                    accent_color: string | null
                    background_image_id: string | null
                    cover_image_id: string | null
                    created_at: string
                    description: string
                    id: string
                    owner_id: string
                    revision: number
                    sort_order: number
                    theme_id: string
                    title: string
                    updated_at: string
                }[]
                SetofOptions: {
                    from: "*"
                    to: "ranking_lists"
                    isOneToOne: false
                    isSetofReturn: true
                }
            }
            save_ranking_with_profile: {
                Args: {
                    p_catalog_expected_revision?: number
                    p_catalog_item?: Json
                    p_entries: Json
                    p_expected_revision?: number
                    p_list: Json
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
        Enums: {},
    },
} as const
