import { supabase } from './client'
import { mapCatalogItem } from './database.mappers'
import { readAllRows } from './readAllRows'
import {
    checkSharedError,
    withSharedRankingPhotos,
} from './sharedRankingPhotos'

export async function getSharedAddCatalog(listId: string) {
    const rows = await readAllRows((afterId, pageSize) => {
        let query = supabase
            .rpc('list_ranking_add_catalog', {
                p_list_id: listId,
            })
            .order('id')
            .limit(pageSize)

        if (afterId) {
            query = query.gt('id', afterId)
        }

        return query
    })

    return rows.map((row) => ({
        ...mapCatalogItem(row),
        ownerId: row.owner_id,
    }))
}

export type SharedCatalogChoice = Awaited<
    ReturnType<typeof getSharedAddCatalog>
>[number]

export async function addSharedRankingEntry(input: {
    listId: string
    ownerId: string
    revision: number
    position: number
    name?: string
    photo?: Blob | null
    background?: Blob | null
    source?: SharedCatalogChoice
}): Promise<void> {
    await withSharedRankingPhotos(
        input.listId,
        input.revision,
        async (preparePhoto) => {
            let profile: string | undefined
            let background: string | undefined

            const source = input.source

            if (source && source.ownerId !== input.ownerId) {
                if (source.value.profileImageId) {
                    profile = await preparePhoto({
                        ownerId: source.ownerId,
                        imageId: source.value.profileImageId,
                    })
                }

                if (source.value.backgroundImageId) {
                    background = await preparePhoto({
                        ownerId: source.ownerId,
                        imageId: source.value.backgroundImageId,
                    })
                }
            } else if (!source) {
                if (input.photo) {
                    profile = await preparePhoto(input.photo)
                }

                if (input.background) {
                    background = await preparePhoto(
                        input.background,
                    )
                }
            }

            const { data, error } = await supabase.rpc(
                'add_shared_ranking_entry',
                {
                    p_list_id: input.listId,
                    p_expected_revision: input.revision,
                    p_entry_id: crypto.randomUUID(),
                    p_position: input.position,
                    p_name: source ? undefined : input.name,
                    p_source_item_id: source?.value.id,
                    p_source_expected_revision: source?.revision,
                    p_profile_image_id: profile,
                    p_background_image_id: background,
                },
            )

            checkSharedError(error)

            if (data === null) {
                throw new Error('Missing saved revision.')
            }
        },
    )
}