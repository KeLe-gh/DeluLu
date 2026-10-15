import type { CatalogItem } from '../../features/catalog'
import type { RankingList } from '../../shared/types/list.types'
import type { Versioned } from '../../shared/types/persistence.types'
import type { Database } from './database.types'

type CatalogRow =
    Database['public']['Tables']['catalog_items']['Row']

type RankingRow =
    Database['public']['Tables']['ranking_lists']['Row']

type EntryRow =
    Database['public']['Tables']['ranking_entries']['Row']

export function mapCatalogItem(
    row: CatalogRow,
): Versioned<CatalogItem> {
    return {
        revision: row.revision,
        value: {
            id: row.id,
            name: row.name,
            description: row.description,
            profileImageId: row.profile_image_id,
            backgroundImageId: row.background_image_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        },
    }
}

export function mapRankingList(
    row: RankingRow,
    entries: readonly EntryRow[],
): Versioned<RankingList> {
    return {
        revision: row.revision,
        value: {
            id: row.id,
            title: row.title,
            description: row.description,
            kind: 'ranking',
            coverImageId: row.cover_image_id,
            appearance: {
                themeId: row.theme_id,
                accentColor: row.accent_color,
                backgroundImageId: row.background_image_id,
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            entries: entries
                .map((entry) => ({
                    id: entry.id,
                    itemId: entry.item_id,
                    position: entry.position,
                    note: entry.note,
                }))
                .sort(
                    (first, second) =>
                        first.position - second.position,
                ),
        },
    }
}