import type {
    RankingRepository,
} from '../../features/rankings'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { supabase } from './client'
import { mapRankingList } from './database.mappers'
import type { Database } from './database.types'
import { readAllRows } from './readAllRows'

type RankingRow =
    Database['public']['Tables']['ranking_lists']['Row']

type EntryRow =
    Database['public']['Tables']['ranking_entries']['Row']

function readRankingRows(): Promise<RankingRow[]> {
    return readAllRows<RankingRow>((afterId, pageSize) => {
        let query = supabase
            .from('ranking_lists')
            .select('*')
            .order('id', { ascending: true })
            .limit(pageSize)

        if (afterId !== null) {
            query = query.gt('id', afterId)
        }

        return query
    })
}

function readEntryRows(): Promise<EntryRow[]> {
    return readAllRows<EntryRow>((afterId, pageSize) => {
        let query = supabase
            .from('ranking_entries')
            .select('*')
            .order('id', { ascending: true })
            .limit(pageSize)

        if (afterId !== null) {
            query = query.gt('id', afterId)
        }

        return query
    })
}

function haveSameRevisions(
    before: readonly RankingRow[],
    after: readonly RankingRow[],
): boolean {
    if (before.length !== after.length) {
        return false
    }

    const revisions = new Map<string, number>(
        before.map((row) => [row.id, row.revision]),
    )

    return after.every(
        (row) => revisions.get(row.id) === row.revision,
    )
}

export const supabaseRankingRepository: RankingRepository = {
    async getAll() {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const before = await readRankingRows()

            if (before.length === 0) {
                return []
            }

            const entries = await readEntryRows()
            const after = await readRankingRows()

            if (!haveSameRevisions(before, after)) {
                continue
            }

            const entriesByList = new Map<string, EntryRow[]>()

            for (const entry of entries) {
                const group = entriesByList.get(entry.list_id)

                if (group) {
                    group.push(entry)
                } else {
                    entriesByList.set(entry.list_id, [entry])
                }
            }

            return after
                .sort(
                    (first, second) =>
                        first.sort_order - second.sort_order ||
                        first.id.localeCompare(second.id),
                )
                .map((row) =>
                    mapRankingList(
                        row,
                        entriesByList.get(row.id) ?? [],
                    ),
                )
        }

        throw new Error(
            'Die Listen wurden während des Ladens geändert. Bitte lade sie erneut.',
        )
    },

    async save(list, expectedRevision) {
        const entries = list.entries.map((entry) => ({
            id: entry.id,
            item_id: entry.itemId,
            position: entry.position,
            note: entry.note,
        }))

        const { data, error } = await supabase
            .rpc('save_ranking_list', {
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
            })
            .single()

        if (error) {
            if (error.code === 'PT409') {
                throw new RevisionConflictError()
            }

            throw error
        }

        if (data === null) {
            throw new Error(
                'Die Liste konnte nicht gespeichert werden.',
            )
        }

        const savedEntries: EntryRow[] = entries.map(
            (entry) => ({
                ...entry,
                owner_id: data.owner_id,
                list_id: data.id,
            }),
        )

        return mapRankingList(data, savedEntries)
    },

    async remove(listId, expectedRevision) {
        const { error } = await supabase.rpc(
            'delete_ranking_list',
            {
                p_id: listId,
                p_expected_revision: expectedRevision,
            },
        )

        if (error) {
            if (error.code === 'PT409') {
                throw new RevisionConflictError()
            }

            throw error
        }
    },

    async reorder(orderedLists) {
        const { error } = await supabase.rpc(
            'reorder_ranking_lists',
            {
                p_lists: orderedLists.map((list) => ({
                    id: list.value.id,
                    revision: list.revision,
                })),
            },
        )

        if (error) {
            if (error.code === 'PT409') {
                throw new RevisionConflictError()
            }

            throw error
        }
    },
}