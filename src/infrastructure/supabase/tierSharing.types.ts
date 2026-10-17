import type { Database } from './database.types'
import type { TierEntryRow, TierListRow, TierRow } from './appDatabase.types'

type ListArgs = { p_list_id: string }
type RevisionArgs = ListArgs & { p_expected_revision: number }
type CatalogRow = Database['public']['Tables']['catalog_items']['Row']

export type TierSharingFunctions = {
    create_tier_share_link: {
        Args: ListArgs & { p_rotate?: boolean }
        Returns: string
    }
    join_tier_share: {
        Args: { p_token: string }
        Returns: string
    }
    list_shared_tiers: {
        Args: Record<string, never>
        Returns: TierListRow[]
    }
    get_shared_tier: {
        Args: ListArgs
        Returns: {
            tier_list: TierListRow
            rows: TierRow[]
            entries: TierEntryRow[]
            catalog_items: CatalogRow[]
        }
    }
    leave_shared_tier: { Args: ListArgs; Returns: boolean }
    stop_tier_sharing: { Args: ListArgs; Returns: boolean }
    reserve_tier_photo: {
        Args: RevisionArgs
        Returns: { owner_id: string; image_id: string }
    }
    list_tier_add_catalog: {
        Args: ListArgs
        Returns: CatalogRow[]
    }
    add_shared_tier_entry: {
        Args: RevisionArgs & {
            p_entry_id: string
            p_name?: string
            p_source_item_id?: string
            p_source_expected_revision?: number
            p_profile_image_id?: string
            p_background_image_id?: string
        }
        Returns: number
    }
    edit_shared_tier_entry: {
        Args: RevisionArgs & {
            p_entry_id: string
            p_catalog_expected_revision: number
            p_name: string
            p_images: {
                profile_image_id?: string | null
                background_image_id?: string | null
            }
        }
        Returns: number
    }
    move_shared_tier_entry: {
        Args: RevisionArgs & {
            p_entry_id: string
            p_tier_id: string | null
            p_index: number
        }
        Returns: number
    }
    remove_shared_tier_entry: {
        Args: RevisionArgs & { p_entry_id: string }
        Returns: number
    }
}