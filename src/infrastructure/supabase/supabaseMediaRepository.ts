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