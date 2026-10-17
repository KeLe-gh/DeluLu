import type { Database } from './database.types'

// Extend the generated schema until the next database type generation.
export type AppDatabase = Omit<Database, 'public'> & {
    public: Omit<Database['public'], 'Tables'> & {
        Tables: Database['public']['Tables'] & {
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