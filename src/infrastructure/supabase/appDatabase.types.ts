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

export type AppDatabase = Omit<Database, 'public'> & {
    public: Omit<Database['public'], 'Tables' | 'Functions'> & {
        Functions: Database['public']['Functions'] & {
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