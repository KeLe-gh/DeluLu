import type { CatalogRepository } from '../../features/catalog'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { supabase } from './client'
import { mapCatalogItem } from './database.mappers'
import type { Database } from './database.types'
import { readAllRows } from './readAllRows'

type CatalogRow =
    Database['public']['Tables']['catalog_items']['Row']

export const supabaseCatalogRepository: CatalogRepository = {
    async getAll() {
        const rows = await readAllRows<CatalogRow>(
            (afterId, pageSize) => {
                let query = supabase
                    .from('catalog_items')
                    .select('*')
                    .order('id', { ascending: true })
                    .limit(pageSize)

                if (afterId !== null) {
                    query = query.gt('id', afterId)
                }

                return query
            },
        )

        return rows.map(mapCatalogItem)
    },

    async save(item, expectedRevision) {
        const { data, error } = await supabase
            .rpc('save_catalog_item', {
                p_id: item.id,
                p_name: item.name,
                p_description: item.description,
                p_profile_image_id:
                    item.profileImageId ?? undefined,
                p_background_image_id:
                    item.backgroundImageId ?? undefined,
                p_expected_revision:
                    expectedRevision ?? undefined,
            })
            .single()

        if (error) {
            if (error.code === 'PT409') {
                throw new RevisionConflictError()
            }

            throw error
        }

        if (data === null) {
            throw new Error(
                'Das Profil konnte nicht gespeichert werden.',
            )
        }

        return mapCatalogItem(data)
    },
}