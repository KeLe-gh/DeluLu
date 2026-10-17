import type { Database } from './database.types'

export type TierListRow = {
    id: string
    owner_id: string
    title: string
    style_id: string
    revision: number
    created_at: string
    updated_at: string
}

export type TierRow = {
    id: string
    owner_id: string
    list_id: string
    label: string
    color: string
    position: number
}

export type TierEntryRow = {
    id: string
    owner_id: string
    list_id: string
    item_id: string
    tier_id: string | null
    position: number
    note: string
}

export type AppDatabase = Omit<Database, 'public'> & {
    public: Omit<Database['public'], 'Tables' | 'Functions'> & {
        Functions: Database['public']['Functions'] & {
            rename_tier_list: {
                Args: {
                    p_id: string
                    p_title: string
                    p_expected_revision: number
                }
                Returns: TierListRow[]
                SetofOptions: {
                    from: '*'
                    to: 'tier_lists'
                    isOneToOne: false
                    isSetofReturn: true
                }
            }

            delete_tier_list: {
                Args: {
                    p_id: string
                    p_expected_revision: number
                }
                Returns: boolean
            }
            delete_catalog_item: {
                Args: {
                    p_id: string
                    p_expected_revision: number
                }
                Returns: boolean
            }
            move_tier_entry: {
                Args: {
                    p_list_id: string
                    p_entry_id: string
                    p_tier_id: string | null
                    p_index: number
                    p_expected_revision: number
                }
                Returns: TierListRow[]
                SetofOptions: {
                    from: '*'
                    to: 'tier_lists'
                    isOneToOne: false
                    isSetofReturn: true
                }
            }

            add_tier_entry: {
                Args: {
                    p_id: string
                    p_list_id: string
                    p_item_id: string
                    p_expected_revision: number
                    p_new_name?: string
                    p_profile_image_id?: string
                }
                Returns: {
                    tier_list: TierListRow
                    catalog_item:
                        Database['public']['Tables']['catalog_items']['Row']
                }
            }

            create_tier_list: {
                Args: {
                    p_id: string
                    p_title: string
                    p_style_id?: string
                }
                Returns: TierListRow[]
                SetofOptions: {
                    from: '*'
                    to: 'tier_lists'
                    isOneToOne: false
                    isSetofReturn: true
                }
            }
        }

        Tables: Database['public']['Tables'] & {
            tier_entries: {
                Row: TierEntryRow
                Insert: {
                    id: string
                    owner_id?: string
                    list_id: string
                    item_id: string
                    tier_id?: string | null
                    position: number
                    note?: string
                }
                Update: {
                    tier_id?: string | null
                    position?: number
                }
                Relationships: []
            }

            tier_lists: {
                Row: TierListRow
                Insert: {
                    id: string
                    owner_id?: string
                    title: string
                    style_id: string
                }
                Update: {
                    title?: string
                }
                Relationships: []
            }

            tier_rows: {
                Row: TierRow
                Insert: {
                    id?: string
                    owner_id?: string
                    list_id: string
                    label: string
                    color: string
                    position: number
                }
                Update: {
                    label?: string
                    color?: string
                    position?: number
                }
                Relationships: []
            }

            app_appearance: {
                Row: {
                    owner_id: string
                    background_image_id: string | null
                    revision: number
                    updated_at: string
                }
                Insert: {
                    owner_id?: string
                    background_image_id?: string | null
                }
                Update: {
                    background_image_id?: string | null
                }
                Relationships: []
            }
        }
    }
}