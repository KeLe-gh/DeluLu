import type {
    MediaThought,
    MediaThoughtRepository,
} from '../../features/media/mediaThought.types'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import type { AppDatabase } from './appDatabase.types'
import { supabase } from './client'
import { readAllRows } from './readAllRows'

type ThoughtRow =
    AppDatabase['public']['Tables']['media_thoughts']['Row']

function mapThought(row: ThoughtRow): MediaThought {
    return {
        id: row.id,
        titleId: row.title_id,
        heading: row.heading,
        body: row.body,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

export const supabaseMediaThoughtRepository: MediaThoughtRepository = {
    async getAll(titleId) {
        const rows = await readAllRows<ThoughtRow>((afterId, size) => {
            let query = supabase
                .from('media_thoughts')
                .select('*')
                .eq('title_id', titleId)
                .order('id')
                .limit(size)

            if (afterId !== null) {
                query = query.gt('id', afterId)
            }

            return query
        })

        return rows.map(mapThought)
    },

    async save(draft, revision) {
        const values = {
            heading: draft.heading.trim(),
            body: draft.body.trim(),
        }

        const query = revision === null
            ? supabase
                .from('media_thoughts')
                .insert({
                    id: draft.id,
                    title_id: draft.titleId,
                    ...values,
                })
            : supabase
                .from('media_thoughts')
                .update(values)
                .eq('id', draft.id)
                .eq('title_id', draft.titleId)
                .eq('revision', revision)

        const { data, error } = await query
            .select('*')
            .maybeSingle()

        if (error?.code === '23505') {
            throw new RevisionConflictError()
        }

        if (error) throw error
        if (!data) throw new RevisionConflictError()

        return mapThought(data)
    },

    async remove(thought) {
        const { data, error } = await supabase
            .from('media_thoughts')
            .delete()
            .eq('id', thought.id)
            .eq('title_id', thought.titleId)
            .eq('revision', thought.revision)
            .select('id')
            .maybeSingle()

        if (error) throw error
        if (!data) throw new RevisionConflictError()
    },
}