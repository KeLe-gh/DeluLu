import type { ProfileImageStore } from '../../features/images/model/profileImageStore'
import { supabase } from './client'

const bucket = 'profile-photos'

const uploaded = new WeakMap<
    Blob,
    { ownerId: string; id: string }
>()

async function ownerId(): Promise<string> {
    const { data, error } = await supabase.auth.getSession()

    if (error || !data.session) {
        throw new Error('Bitte melde dich erneut an.')
    }

    return data.session.user.id
}

function path(owner: string, id: string): string {
    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidPattern.test(id)) {
        throw new Error('Ungültige Foto-ID.')
    }

    return `${owner}/${id}.jpg`
}

export const supabaseProfileImageStore: ProfileImageStore = {
    async upload(photo) {
        if (
            photo.type !== 'image/jpeg' ||
            photo.size === 0 ||
            photo.size > 2 * 1024 * 1024
        ) {
            throw new Error('Das vorbereitete Foto ist ungültig.')
        }

        const owner = await ownerId()
        const cached = uploaded.get(photo)

        if (cached?.ownerId === owner) {
            return cached.id
        }

        const id = crypto.randomUUID()

        const { error } = await supabase.storage
            .from(bucket)
            .upload(path(owner, id), photo, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: false,
            })

        if (error) throw error

        uploaded.set(photo, { ownerId: owner, id })

        return id
    },

    async download(id) {
        const owner = await ownerId()

        const { data, error } = await supabase.storage
            .from(bucket)
            .download(path(owner, id))

        if (error) throw error

        return data
    },

        async cleanupUnused() {
            await ownerId()

            const { data, error } = await supabase.rpc(
                'list_profile_photo_cleanup',
            )

            if (error) throw error

            for (const row of data ?? []) {
                const filePath = path(
                    row.owner_id,
                    row.image_id,
                )

                const { error: removeError } = await supabase.storage
                    .from(bucket)
                    .remove([filePath])

                if (removeError) throw removeError

                const {
                    data: exists,
                    error: existsError,
                } = await supabase.storage
                    .from(bucket)
                    .exists(filePath)

                if (
                    existsError &&
                    existsError.status !== 400 &&
                    existsError.status !== 404
                ) {
                    throw existsError
                }

                if (exists) continue

                const { error: queueError } = await supabase.rpc(
                    'ack_profile_photo_cleanup',
                    {
                        p_owner_id: row.owner_id,
                        p_image_id: row.image_id,
                    },
                )

                if (queueError) throw queueError
            }
        },
}