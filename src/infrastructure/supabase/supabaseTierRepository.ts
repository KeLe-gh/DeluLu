import type { TierRepository } from '../../features/tiers/tier.repository'
import type { TierList } from '../../shared/types/list.types'
import type { Versioned } from '../../shared/types/persistence.types'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { supabase } from './client'
import { readAllRows } from './readAllRows'
import { mapCatalogItem } from './database.mappers'
import type {
    TierListRow,
    TierRow,
    TierEntryRow,
} from './appDatabase.types'

function mapList(
    row: TierListRow,
    rows: readonly TierRow[],
    entries: readonly TierEntryRow[],
): Versioned<TierList> {
    const tiers = rows
        .filter((tier) => tier.list_id === row.id)
        .sort((a, b) => a.position - b.position)
        .map(({ id, label, color }) => ({ id, label, color }))

    if (tiers.length !== 7) {
        throw new Error('Die Tierliste ist unvollständig.')
    }

    return {
        revision: row.revision,
        value: {
            id: row.id,
            title: row.title,
            kind: 'tier',
            styleId: row.style_id,
            description: '',
            coverImageId: null,
            appearance: {
                themeId: 'default',
                accentColor: null,
                backgroundImageId: null,
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            tiers,
            entries: entries
                .filter((entry) => entry.list_id === row.id)
                .sort((a, b) => a.position - b.position)
                .map((entry) => ({
                    id: entry.id,
                    itemId: entry.item_id,
                    tierId: entry.tier_id,
                    note: entry.note,
                })),
        },
    }
}

function readTiers(listId?: string) {
    return readAllRows<TierRow>((afterId, pageSize) => {
        let query = supabase
            .from('tier_rows')
            .select('*')
            .order('id')
            .limit(pageSize)

        if (listId) query = query.eq('list_id', listId)
        if (afterId) query = query.gt('id', afterId)

        return query
    })
}

function readEntries(listId?: string) {
    return readAllRows<TierEntryRow>((afterId, pageSize) => {
        let query = supabase
            .from('tier_entries')
            .select('*')
            .order('id')
            .limit(pageSize)

        if (listId) query = query.eq('list_id', listId)
        if (afterId) query = query.gt('id', afterId)

        return query
    })
}

async function readList(row: TierListRow) {
    const [tiers, entries] = await Promise.all([
        readTiers(row.id),
        readEntries(row.id),
    ])

    return mapList(row, tiers, entries)
}

export const supabaseTierRepository: TierRepository = {
    async getAll() {
        const lists = await readAllRows<TierListRow>(
            (afterId, pageSize) => {
                let query = supabase
                    .from('tier_lists')
                    .select('*')
                    .order('id')
                    .limit(pageSize)

                if (afterId) {
                    query = query.gt('id', afterId)
                }

                return query
            },
        )

        const [rows, entries] = await Promise.all([
            readTiers(),
            readEntries(),
        ])

        return lists
            .map((list) => mapList(list, rows, entries))
            .sort((a, b) =>
                b.value.createdAt.localeCompare(a.value.createdAt) ||
                b.value.id.localeCompare(a.value.id),
            )
    },

    async create(input) {
        const { data, error } = await supabase
            .rpc('create_tier_list', {
                p_id: input.id,
                p_title: input.title,
                p_style_id: input.styleId,
            })
            .single()

        if (error) throw error

        if (!data) {
            throw new Error(
                'Die Tierliste konnte nicht erstellt werden.',
            )
        }

        return readList(data)
    },

    async addEntry(input) {
        const { data, error } = await supabase
            .rpc('add_tier_entry', {
                p_id: input.id,
                p_list_id: input.listId,
                p_item_id: input.itemId,
                p_expected_revision: input.expectedRevision,
                p_new_name: input.newProfile?.name,
                p_profile_image_id:
                    input.newProfile?.profileImageId ?? undefined,
            })

        if (
            error?.code === 'PT409' ||
            error?.code === '23505'
        ) {
            throw new RevisionConflictError()
        }

        if (error) throw error

        if (!data?.tier_list || !data.catalog_item) {
            throw new Error(
                'Die Antwort beim Speichern ist ungültig.',
            )
        }

        return {
            list: await readList(data.tier_list),
            item: mapCatalogItem(data.catalog_item),
        }
    },
}