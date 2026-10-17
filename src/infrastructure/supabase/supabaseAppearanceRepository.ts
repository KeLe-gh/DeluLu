import type { AppearanceRepository } from '../../features/appearance/appearance.repository'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { supabase } from './client'

async function ownerId() {
    const { data, error } = await supabase.auth.getSession()

    if (error || !data.session) {
        throw new Error('Bitte melde dich erneut an.')
    }

    return data.session.user.id
}

export const supabaseAppearanceRepository: AppearanceRepository = {
    async load() {
        const owner = await ownerId()

        const { data, error } = await supabase
            .from('app_appearance')
            .select('background_image_id, revision')
            .eq('owner_id', owner)
            .maybeSingle()

        if (error) throw error

        return data
            ? {
                value: {
                    backgroundImageId: data.background_image_id,
                },
                revision: data.revision,
            }
            : null
    },

    async save(appearance, expectedRevision) {
        const owner = await ownerId()
        const table = supabase.from('app_appearance')

        const query = expectedRevision === null
            ? table.insert({
                owner_id: owner,
                background_image_id: appearance.backgroundImageId,
            })
            : table
                .update({
                    background_image_id: appearance.backgroundImageId,
                })
                .eq('owner_id', owner)
                .eq('revision', expectedRevision)

        const { data, error } = await query
            .select('background_image_id, revision')
            .maybeSingle()

        if (
            error?.code === '23505' ||
            (!error && !data)
        ) {
            throw new RevisionConflictError()
        }

        if (error) throw error

        if (!data) {
            throw new Error(
                'Der Hintergrund konnte nicht gespeichert werden.',
            )
        }

        return {
            value: {
                backgroundImageId: data.background_image_id,
            },
            revision: data.revision,
        }
    },
}