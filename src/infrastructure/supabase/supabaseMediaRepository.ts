import type {
    MediaRepository,
    MediaTitle,
} from '../../features/media/media.types'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import type { AppDatabase } from './appDatabase.types'
import { supabase } from './client'
import { readAllRows } from './readAllRows'

type MediaRow =
    AppDatabase['public']['Tables']['media_titles']['Row']

function mapTitle(row: MediaRow): MediaTitle {
    return {
        id: row.id,
        sortOrder: row.sort_order,
        name: row.name,
        kind: row.kind,
        status: row.status,
        rating: row.rating,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export const supabaseMediaRepository: MediaRepository = {
    async reorder(status, items) {
        const { data, error } = await supabase.rpc(
            'reorder_media_titles',
            {
                p_status: status,
                p_items: items.map((item) => ({
                    id: item.id,
                    revision: item.revision,
                })),
            },
        )

        if (error?.code === 'PT409') {
            throw new RevisionConflictError()
        }

        if (error) throw error

        if (data === null) {
            throw new Error(
                'Die Reihenfolge konnte nicht gespeichert werden.',
            )
        }

        if (data.length !== items.length) {
            return (await supabaseMediaRepository.getAll())
                .filter((title) => title.status === status)
        }

        return data.map(mapTitle)
    },

    async remove(title) {
        const { data, error } = await supabase.rpc(
            'delete_media_title',
            {
                p_id: title.id,
                p_expected_revision: title.revision,
            },
        )

        if (error?.code === 'PT409') {
            throw new RevisionConflictError()
        }

        if (error) throw error

        if (data !== true) {
            throw new Error(
                'Der Eintrag konnte nicht gelöscht werden.',
            )
        }
    },

    async getAll() {
        const rows = await readAllRows<MediaRow>((afterId, size) => {
            let query = supabase
                .from('media_titles')
                .select('*')
                .order('id')
                .limit(size)

            if (afterId !== null) {
                query = query.gt('id', afterId)
            }

            return query
        })

        return rows.map(mapTitle)
    },

    async save(draft, expectedRevision) {
        const values = {
            name: draft.name.trim(),
            kind: draft.kind,
            status: draft.status,
            rating: draft.rating,
        }

        const query = expectedRevision === null
            ? supabase
                .from('media_titles')
                .insert({ id: draft.id, ...values })
            : supabase
                .from('media_titles')
                .update(values)
                .eq('id', draft.id)
                .eq('revision', expectedRevision)

        const { data, error } = await query
            .select('*')
            .maybeSingle()

        if (error?.code === '23505') {
            throw new RevisionConflictError()
        }

        if (error) throw error
        if (!data) throw new RevisionConflictError()

        return mapTitle(data)
    },
}