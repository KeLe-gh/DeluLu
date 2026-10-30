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
        Functions:
            Database['public']['Functions'] &
            import('./tierSharing.types').TierSharingFunctions &
            import('./chatDatabase.types').ChatFunctions & {
            edit_shared_ranking_entry: {
                Args: {
                    p_list_id: string
                    p_expected_revision: number
                    p_entry_id: string
                    p_catalog_expected_revision: number
                    p_name: string
                    p_position: number
                    p_images: {
                        profile_image_id?: string | null
                        background_image_id?: string | null
                    }
                }
                Returns: number
            }
            reserve_ranking_photo: {
                Args: {
                    p_list_id: string
                    p_expected_revision: number
                }
                Returns: {
                    owner_id: string
                    image_id: string
                }
            }

            cancel_ranking_photo: {
                Args: { p_image_id: string }
                Returns: undefined
            }

            list_profile_photo_cleanup: {
                Args: Record<string, never>
                Returns: {
                    owner_id: string
                    image_id: string
                }[]
            }

            ack_profile_photo_cleanup: {
                Args: {
                    p_owner_id: string
                    p_image_id: string
                }
                Returns: boolean
            }

            list_ranking_add_catalog: {
                Args: { p_list_id: string }
                Returns: Database['public']['Tables']['catalog_items']['Row'][]
                SetofOptions: {
                    from: '*'
                    to: 'catalog_items'
                    isOneToOne: false
                    isSetofReturn: true
                }
            }

            add_shared_ranking_entry: {
                Args: {
                    p_list_id: string
                    p_expected_revision: number
                    p_entry_id: string
                    p_position: number
                    p_name?: string
                    p_source_item_id?: string
                    p_source_expected_revision?: number
                    p_profile_image_id?: string
                    p_background_image_id?: string
                }
                Returns: number
            }
            update_shared_ranking_entries: {
                Args: {
                    p_list_id: string
                    p_expected_revision: number
                    p_entries: {
                        id: string
                        position: number
                    }[]
                }
                Returns: number
            }
            create_ranking_share_link: {
                Args: { p_list_id: string; p_rotate?: boolean }
                Returns: string
            }

            join_ranking_share: {
                Args: { p_token: string }
                Returns: string
            }

            list_shared_rankings: {
                Args: Record<string, never>
                Returns: Database['public']['Tables']['ranking_lists']['Row'][]
                SetofOptions: {
                    from: '*'
                    to: 'ranking_lists'
                    isOneToOne: false
                    isSetofReturn: true
                }
            }

            get_shared_ranking: {
                Args: { p_list_id: string }
                Returns: {
                    ranking_list: Database['public']['Tables']['ranking_lists']['Row']
                    entries: Database['public']['Tables']['ranking_entries']['Row'][]
                    catalog_items: Database['public']['Tables']['catalog_items']['Row'][]
                }
            }

            leave_shared_ranking: {
                Args: { p_list_id: string }
                Returns: boolean
            }

            stop_ranking_sharing: {
                Args: { p_list_id: string }
                Returns: boolean
            }
            delete_media_title: {
                Args: {
                    p_id: string
                    p_expected_revision: number
                }
                Returns: boolean
            }

            reorder_media_titles: {
                Args: {
                    p_status: string
                    p_items: import('./database.types').Json
                }
                Returns:
                    AppDatabase['public']['Tables']['media_titles']['Row'][]
                SetofOptions: {
                    from: '*'
                    to: 'media_titles'
                    isOneToOne: false
                    isSetofReturn: true
                }
            }

            reorder_media_thoughts: {
                Args: {
                    p_title_id: string
                    p_items: import('./database.types').Json
                }
                Returns:
                    AppDatabase['public']['Tables']['media_thoughts']['Row'][]
                SetofOptions: {
                    from: '*'
                    to: 'media_thoughts'
                    isOneToOne: false
                    isSetofReturn: true
                }
            }

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
            media_thoughts: {
                Row: {
                    sort_order: number
                    id: string
                    owner_id: string
                    title_id: string
                    heading: string
                    body: string
                    revision: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    title_id: string
                    heading?: string
                    body: string
                }
                Update: {
                    heading?: string
                    body?: string
                }
                Relationships: []
            }

            media_titles: {
                Row: {
                    sort_order: number
                    id: string
                    owner_id: string
                    name: string
                    kind: 'series' | 'movie'
                    status:
                        | 'watchlist'
                        | 'watching'
                        | 'watched'
                        | 'dropped'
                    rating: number | null
                    revision: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    name: string
                    kind: 'series' | 'movie'
                    status:
                        | 'watchlist'
                        | 'watching'
                        | 'watched'
                        | 'dropped'
                    rating?: number | null
                }
                Update: {
                    name?: string
                    kind?: 'series' | 'movie'
                    status?:
                        | 'watchlist'
                        | 'watching'
                        | 'watched'
                        | 'dropped'
                    rating?: number | null
                }
                Relationships: []
            }

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