import type { ProfileImageStore } from '../../features/images/model/profileImageStore'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { supabase } from './client'
import {
    mapCatalogItem,
    mapRankingList,
} from './database.mappers'
import { readAllRows } from './readAllRows'

export class SharedRankingUnavailableError extends Error {
    constructor() {
        super('This shared list is unavailable.')
        this.name = 'SharedRankingUnavailableError'
    }
}

export const supabaseRankingSharing = {
    async createLink(listId: string): Promise<string> {
        const { data, error } = await supabase.rpc(
            'create_ranking_share_link',
            { p_list_id: listId },
        )

        if (error) throw error

        if (!data || !/^[0-9a-f]{64}$/.test(data)) {
            throw new Error('Invalid invitation response.')
        }

        const url = new URL(window.location.href)
        url.search = ''
        url.hash = '/share/' + data

        return url.href
    },

    async join(token: string): Promise<string> {
        const { data, error } = await supabase.rpc(
            'join_ranking_share',
            { p_token: token },
        )

        if (error) throw error
        if (!data) throw new Error('Missing list ID.')

        return data
    },

    async list() {
        const rows = await readAllRows((afterId, pageSize) => {
            let query = supabase
                .rpc('list_shared_rankings')
                .order('id')
                .limit(pageSize)

            if (afterId) {
                query = query.gt('id', afterId)
            }

            return query
        })

        return rows.sort(
            (a, b) =>
                b.created_at.localeCompare(a.created_at) ||
                a.id.localeCompare(b.id),
        )
    },

    async read(listId: string) {
        const [response, session] = await Promise.all([
            supabase.rpc('get_shared_ranking', {
                p_list_id: listId,
            }),
            supabase.auth.getSession(),
        ])

        if (response.error?.code === 'PT404') {
            throw new SharedRankingUnavailableError()
        }

        if (response.error) throw response.error
        if (session.error) throw session.error

        const data = response.data

        if (!data || !session.data.session) {
            throw new Error('List unavailable.')
        }

        return {
            ownerId: data.ranking_list.owner_id,
            isOwner:
                data.ranking_list.owner_id ===
                session.data.session.user.id,
            revision: data.ranking_list.revision,
            catalogRevisions: Object.fromEntries(
                data.catalog_items.map(
                    (row) => [row.id, row.revision],
                ),
            ),
            list: mapRankingList(
                data.ranking_list,
                data.entries,
            ).value,
            items: data.catalog_items.map(
                (row) => mapCatalogItem(row).value,
            ),
        }
    },

    async saveEntries(
        listId: string,
        expectedRevision: number,
        entries: readonly {
            id: string
            position: number
        }[],
    ): Promise<void> {
        const { data, error } = await supabase.rpc(
            'update_shared_ranking_entries',
            {
                p_list_id: listId,
                p_expected_revision: expectedRevision,
                p_entries: entries.map(
                    ({ id, position }) => ({
                        id,
                        position,
                    }),
                ),
            },
        )

        if (error?.code === 'PT409') {
            throw new RevisionConflictError()
        }

        if (error?.code === 'PT404') {
            throw new SharedRankingUnavailableError()
        }

        if (error) throw error

        if (data === null) {
            throw new Error('Missing saved revision.')
        }
    },

    async leave(listId: string): Promise<void> {
        const { error } = await supabase.rpc(
            'leave_shared_ranking',
            { p_list_id: listId },
        )

        if (error) throw error
    },

    async stop(listId: string): Promise<void> {
        const { error } = await supabase.rpc(
            'stop_ranking_sharing',
            { p_list_id: listId },
        )

        if (error) throw error
    },
}

export function sharedRankingImages(
    ownerId: string,
): ProfileImageStore {
    return {
        async download(id) {
            const { data, error } = await supabase.storage
                .from('profile-photos')
                .download(`${ownerId}/${id}.jpg`)

            if (error) throw error

            return data
        },

        async upload() {
            throw new Error(
                'Shared photos are read-only for now.',
            )
        },

        async cleanupUnused() {},
    }
}