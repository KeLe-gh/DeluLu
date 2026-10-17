import type { PhotoChange } from '../../features/images/model/profileImageStore'
import { supabase } from './client'
import {
    checkSharedError,
    withSharedRankingPhotos,
} from './sharedRankingPhotos'

export async function editSharedRankingEntry(input: {
    listId: string
    revision: number
    entryId: string
    catalogRevision: number
    name: string
    position: number
    photo: PhotoChange
    background: PhotoChange
}): Promise<void> {
    await withSharedRankingPhotos(
        input.listId,
        input.revision,
        async (prepare) => {
            const images: {
                profile_image_id?: string | null
                background_image_id?: string | null
            } = {}

            if (input.photo !== undefined) {
                images.profile_image_id =
                    input.photo === null
                        ? null
                        : await prepare(input.photo)
            }

            if (input.background !== undefined) {
                images.background_image_id =
                    input.background === null
                        ? null
                        : await prepare(input.background)
            }

            const { data, error } = await supabase.rpc(
                'edit_shared_ranking_entry',
                {
                    p_list_id: input.listId,
                    p_expected_revision: input.revision,
                    p_entry_id: input.entryId,
                    p_catalog_expected_revision:
                    input.catalogRevision,
                    p_name: input.name,
                    p_position: input.position,
                    p_images: images,
                },
            )

            checkSharedError(error)

            if (data === null) {
                throw new Error('Missing saved revision.')
            }
        },
    )
}