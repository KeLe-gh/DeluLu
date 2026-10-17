import type { TierRepository } from '../../features/tiers/tier.repository'
import type { TierList } from '../../shared/types/list.types'
import type { Versioned } from '../../shared/types/persistence.types'
import { supabase } from './client'
import { readAllRows } from './readAllRows'
import type { TierListRow, TierRow } from './appDatabase.types'

function mapList(
    row: TierListRow,
    rows: readonly TierRow[],
): Versioned<TierList> {
    const tiers = rows
        .filter((tier) => tier.list_id === row.id)
        .sort((a, b) => a.position - b.position)
        .map(({ id, label, color }) => ({
            id,
            label,
            color,
        }))

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
            entries: [],
        },
    }
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

        const rows = await readAllRows<TierRow>(
            (afterId, pageSize) => {
                let query = supabase
                    .from('tier_rows')
                    .select('*')
                    .order('id')
                    .limit(pageSize)

                if (afterId) {
                    query = query.gt('id', afterId)
                }

                return query
            },
        )

        return lists
            .map((list) => mapList(list, rows))
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

        const result = await supabase
            .from('tier_rows')
            .select('*')
            .eq('list_id', data.id)
            .order('position')

        if (result.error) throw result.error

        return mapList(data, result.data ?? [])
    },
}