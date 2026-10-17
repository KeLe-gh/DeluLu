import type { CatalogItem } from '../catalog'
import type { TierList } from '../../shared/types/list.types'
import type { Versioned } from '../../shared/types/persistence.types'
import type { TierStyleId } from './tier.styles'

export interface CreateTierListInput {
    id: string
    title: string
    styleId: TierStyleId
}

export type TierEntryDraft = {
    id: string
    itemId: string
} & (
    | { source: 'catalog' }
    | {
    source: 'new'
    name: string
    photo: Blob | null
}
    )

export interface AddTierEntryInput {
    id: string
    listId: string
    itemId: string
    expectedRevision: number
    newProfile?: {
        name: string
        profileImageId: string | null
    }
}

export interface TierEntrySaveResult {
    list: Versioned<TierList>
    item: Versioned<CatalogItem>
}

export interface TierRepository {
    getAll(): Promise<Versioned<TierList>[]>

    create(
        input: CreateTierListInput,
    ): Promise<Versioned<TierList>>

    addEntry(
        input: AddTierEntryInput,
    ): Promise<TierEntrySaveResult>
}