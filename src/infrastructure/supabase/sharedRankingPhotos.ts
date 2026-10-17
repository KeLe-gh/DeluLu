import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { supabase } from './client'
import { SharedRankingUnavailableError } from './supabaseRankingSharing'
import { supabaseProfileImageStore } from './supabaseProfileImageStore'

export function checkSharedError(error: { code?: string } | null) {
    if (error?.code === 'PT409') throw new RevisionConflictError()
    if (error?.code === 'PT404') throw new SharedRankingUnavailableError()
    if (error) throw error
}

type PhotoSource = Blob | { ownerId: string; imageId: string }

export async function withSharedRankingPhotos(
    listId: string,
    revision: number,
    action: (prepare: (photo: PhotoSource) => Promise<string>) => Promise<void>,
    kind: 'ranking' | 'tier' = 'ranking',
): Promise<void> {
    const uploads: string[] = []
    let confirmed = false

    async function prepare(photo: PhotoSource) {
        if (photo instanceof Blob && (
            photo.type !== 'image/jpeg' ||
            !photo.size ||
            photo.size > 2 * 1024 * 1024
        )) {
            throw new Error('Das vorbereitete Foto ist ungültig.')
        }

        const { data, error } = await supabase.rpc(
            kind === 'tier' ? 'reserve_tier_photo' : 'reserve_ranking_photo',
            { p_list_id: listId, p_expected_revision: revision },
        )

        checkSharedError(error)
        if (!data) throw new Error('Missing photo reservation.')

        uploads.push(data.image_id)

        const destination = `${data.owner_id}/${data.image_id}.jpg`
        const bucket = supabase.storage.from('profile-photos')

        const result = photo instanceof Blob
            ? await bucket.upload(destination, photo, {
                contentType: 'image/jpeg',
                upsert: false,
            })
            : await bucket.copy(
                `${photo.ownerId}/${photo.imageId}.jpg`,
                destination,
            )

        if (result.error) throw result.error
        return data.image_id
    }

    try {
        await action(prepare)
        confirmed = true
    } finally {
        if (!confirmed && uploads.length) {
            const cancellations = await Promise.allSettled(
                uploads.map(async (id) => {
                    const { error } = await supabase.rpc(
                        'cancel_ranking_photo',
                        { p_image_id: id },
                    )
                    if (error) throw error
                }),
            )

            if (cancellations.some((result) => result.status === 'rejected')) {
                console.warn(
                    '[deluLu] Photo cancellation will be retried by expiry cleanup.',
                )
            }
        }

        try {
            await supabaseProfileImageStore.cleanupUnused()
        } catch (error) {
            console.warn('[deluLu] Photo cleanup failed:', error)
        }
    }
}