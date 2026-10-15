import type { RankingRepository } from '../../features/rankings'
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

            return after.map((row) =>
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
}