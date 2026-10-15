import type {
    IsoDateTime,
    ItemId,
} from '../../../shared/types/list.types'
import type { CatalogItem } from './catalog.types'

interface CreateCatalogItemInput {
    id: ItemId
    name: string
    timestamp: IsoDateTime
}

interface RenameCatalogItemInput {
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

export function renameCatalogItem(
    item: CatalogItem,
    input: RenameCatalogItemInput,
): CatalogItem | null {
    const name = input.name.trim()

    if (name === '') {
        return null
    }

    return {
        ...item,
        name,
        updatedAt: input.timestamp,
    }
}