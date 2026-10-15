import type {
    IsoDateTime,
    ItemId,
} from '../../../shared/types/list.types'
import type { CatalogItem } from './catalog.types.ts'

interface CreateCatalogItemInput {
    id: ItemId
    name: string
    timestamp: IsoDateTime
}

export function createCatalogItem(
    input: CreateCatalogItemInput,
): CatalogItem | null {
    const name = input.name.trim()

    if (name === '') {
        return null
    }

    return {
        id: input.id,
        name,
        description: '',
        profileImageId: null,
        backgroundImageId: null,
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
    }
}