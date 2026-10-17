import type { TierList } from '../../shared/types/list.types'
import type { Versioned } from '../../shared/types/persistence.types'
import type { TierStyleId } from './tier.styles'

export interface CreateTierListInput {
    id: string
    title: string
    styleId: TierStyleId
}

export interface TierRepository {
    getAll(): Promise<Versioned<TierList>[]>

    create(
        input: CreateTierListInput,
    ): Promise<Versioned<TierList>>
}