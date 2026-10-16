import type {
    RankingEditorRepository,
} from '../../app/model/rankingEditor.repository'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { supabase } from './client'
import {
    mapCatalogItem,
    mapRankingList,
} from './database.mappers'
import type { Database } from './database.types'

type RankingRow =
    Database['public']['Tables']['ranking_lists']['Row']

type CatalogRow =
    Database['public']['Tables']['catalog_items']['Row']

type EntryRow =
    Database['public']['Tables']['ranking_entries']['Row']

interface SaveResponse {
    ranking_list: RankingRow
    catalog_item: CatalogRow | null
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    )
}

function hasRowFields(
    value: unknown,
    stringFields: readonly string[],
    nullableStringFields: readonly string[],
): boolean {
    if (!isRecord(value)) {
        return false
    }

    return (
        typeof value.revision === 'number' &&
        Number.isSafeInteger(value.revision) &&
        value.revision >= 0 &&
        stringFields.every(
            (field) => typeof value[field] === 'string',
        ) &&
        nullableStringFields.every(
            (field) =>
                value[field] === null ||
                typeof value[field] === 'string',
        )
    )
}

function isSaveResponse(
    value: unknown,
): value is SaveResponse {
    if (!isRecord(value)) {
        return false
    }

    return (
        hasRowFields(
            value.ranking_list,
            [
                'id',
                'owner_id',
                'title',
                'description',
                'theme_id',
                'created_at',
                'updated_at',
            ],
            [
                'cover_image_id',
                'accent_color',
                'background_image_id',
            ],
        ) &&
        (
            value.catalog_item === null ||
            hasRowFields(
                value.catalog_item,
                [
                    'id',
                    'owner_id',
                    'name',
                    'description',
                    'created_at',
                    'updated_at',
                ],
                [
                    'profile_image_id',
                    'background_image_id',
                ],
            )
        )
    )
}

export const supabaseRankingEditorRepository:
    RankingEditorRepository = {
    async save(input) {
        const { list, expectedRevision, catalogChange } = input

        const entries = list.entries.map((entry) => ({
            id: entry.id,
            item_id: entry.itemId,
            position: entry.position,
            note: entry.note,
        }))

        const catalogPayload = catalogChange
            ? {
                id: catalogChange.item.id,
                name: catalogChange.item.name,
                description: catalogChange.item.description,
                profile_image_id:
                catalogChange.item.profileImageId,
                background_image_id:
                catalogChange.item.backgroundImageId,
            }
            : undefined

        const { data, error } = await supabase
            .rpc('save_ranking_with_profile', {
                p_list: {
                    id: list.id,
                    title: list.title,
                    description: list.description,
                    cover_image_id: list.coverImageId,
                    theme_id: list.appearance.themeId,
                    accent_color: list.appearance.accentColor,
                    background_image_id:
                    list.appearance.backgroundImageId,
                },
                p_entries: entries,
                p_expected_revision:
                    expectedRevision ?? undefined,
                p_catalog_item: catalogPayload,
                p_catalog_expected_revision:
                    catalogChange?.expectedRevision ?? undefined,
            })

        if (error) {
            if (error.code === 'PT409') {
                throw new RevisionConflictError()
            }

            throw error
        }

        if (!isSaveResponse(data)) {
            throw new Error(
                'Die Antwort beim Speichern hat ein ungültiges Format.',
            )
        }

        const savedEntries: EntryRow[] = entries.map(
            (entry) => ({
                ...entry,
                owner_id: data.ranking_list.owner_id,
                list_id: data.ranking_list.id,
            }),
        )

        return {
            list: mapRankingList(
                data.ranking_list,
                savedEntries,
            ),
            catalogItem: data.catalog_item === null
                ? null
                : mapCatalogItem(data.catalog_item),
        }
    },
}