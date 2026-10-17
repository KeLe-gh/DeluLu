import type { PhotoChange } from '../../features/images/model/profileImageStore'
import type { TierEntryDraft } from '../../features/tiers/tier.repository'
import { supabase } from './client'
import { mapCatalogItem } from './database.mappers'
import { mapList as mapTierList } from './supabaseTierRepository'
import { checkSharedError, withSharedRankingPhotos } from './sharedRankingPhotos'
import { readAllRows } from './readAllRows'

type Choice = ReturnType<typeof mapCatalogItem> & { ownerId: string }

function checked<T>(result: {
    data: T | null
    error: { code?: string } | null
}): T {
    checkSharedError(result.error)
    if (result.data === null) throw new Error('Missing server response.')
    return result.data
}

export const supabaseTierSharing = {
    async createLink(id: string) {
        const token = checked(await supabase.rpc(
            'create_tier_share_link',
            { p_list_id: id },
        ))

        if (!/^[0-9a-f]{64}$/.test(token)) {
            throw new Error('Invalid invitation.')
        }

        const url = new URL(window.location.href)
        url.search = ''
        url.hash = '/tier-share/' + token
        return url.href
    },

    async join(token: string) {
        return checked(await supabase.rpc(
            'join_tier_share',
            { p_token: token },
        ))
    },

    async list() {
        const rows = await readAllRows((after, size) => {
            let query = supabase.rpc('list_shared_tiers')
                .order('id')
                .limit(size)

            if (after) query = query.gt('id', after)
            return query
        })

        return rows.sort((a, b) =>
            b.created_at.localeCompare(a.created_at) ||
            a.id.localeCompare(b.id),
        )
    },

    async read(id: string) {
        const [response, auth] = await Promise.all([
            supabase.rpc('get_shared_tier', { p_list_id: id }),
            supabase.auth.getSession(),
        ])

        const data = checked(response)
        if (auth.error) throw auth.error
        if (!auth.data.session) throw new Error('Authentication required.')

        return {
            ownerId: data.tier_list.owner_id,
            isOwner:
                data.tier_list.owner_id === auth.data.session.user.id,
            revision: data.tier_list.revision,
            catalogRevisions: Object.fromEntries(
                data.catalog_items.map((item) => [item.id, item.revision]),
            ),
            list: mapTierList(
                data.tier_list,
                data.rows,
                data.entries,
            ).value,
            items: data.catalog_items.map(
                (item) => mapCatalogItem(item).value,
            ),
        }
    },

    async choices(id: string) {
        const rows = await readAllRows((after, size) => {
            let query = supabase.rpc(
                'list_tier_add_catalog',
                { p_list_id: id },
            ).order('id').limit(size)

            if (after) query = query.gt('id', after)
            return query
        })

        return rows.map((row) => ({
            ...mapCatalogItem(row),
            ownerId: row.owner_id,
        }))
    },

    async add(
        id: string,
        ownerId: string,
        revision: number,
        draft: TierEntryDraft,
        source?: Choice,
    ) {
        await withSharedRankingPhotos(id, revision, async (prepare) => {
            let profile: string | undefined
            let background: string | undefined

            if (draft.source === 'catalog') {
                if (!source || source.value.id !== draft.itemId) {
                    throw new Error('Missing profile.')
                }

                if (source.ownerId !== ownerId) {
                    if (source.value.profileImageId) {
                        profile = await prepare({
                            ownerId: source.ownerId,
                            imageId: source.value.profileImageId,
                        })
                    }

                    if (source.value.backgroundImageId) {
                        background = await prepare({
                            ownerId: source.ownerId,
                            imageId: source.value.backgroundImageId,
                        })
                    }
                }
            } else {
                if (draft.photo) profile = await prepare(draft.photo)
                if (draft.background) {
                    background = await prepare(draft.background)
                }
            }

            checked(await supabase.rpc('add_shared_tier_entry', {
                p_list_id: id,
                p_expected_revision: revision,
                p_entry_id: draft.id,
                p_name: draft.source === 'new' ? draft.name : undefined,
                p_source_item_id: source?.value.id,
                p_source_expected_revision: source?.revision,
                p_profile_image_id: profile,
                p_background_image_id: background,
            }))
        }, 'tier')
    },

    async edit(
        id: string,
        revision: number,
        entryId: string,
        catalogRevision: number,
        name: string,
        photo: PhotoChange,
        background: PhotoChange,
    ) {
        await withSharedRankingPhotos(id, revision, async (prepare) => {
            const images: {
                profile_image_id?: string | null
                background_image_id?: string | null
            } = {}

            if (photo !== undefined) {
                images.profile_image_id =
                    photo === null ? null : await prepare(photo)
            }

            if (background !== undefined) {
                images.background_image_id =
                    background === null ? null : await prepare(background)
            }

            checked(await supabase.rpc('edit_shared_tier_entry', {
                p_list_id: id,
                p_expected_revision: revision,
                p_entry_id: entryId,
                p_catalog_expected_revision: catalogRevision,
                p_name: name,
                p_images: images,
            }))
        }, 'tier')
    },

    async move(
        id: string,
        revision: number,
        entryId: string,
        tierId: string | null,
        index: number,
    ) {
        checked(await supabase.rpc('move_shared_tier_entry', {
            p_list_id: id,
            p_expected_revision: revision,
            p_entry_id: entryId,
            p_tier_id: tierId,
            p_index: index,
        }))
    },

    async remove(id: string, revision: number, entryId: string) {
        checked(await supabase.rpc('remove_shared_tier_entry', {
            p_list_id: id,
            p_expected_revision: revision,
            p_entry_id: entryId,
        }))
    },

    async leave(id: string) {
        checked(await supabase.rpc(
            'leave_shared_tier',
            { p_list_id: id },
        ))
    },

    async stop(id: string) {
        checked(await supabase.rpc(
            'stop_tier_sharing',
            { p_list_id: id },
        ))
    },
}