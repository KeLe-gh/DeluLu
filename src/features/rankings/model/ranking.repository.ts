import type { RankingList } from '../../../shared/types/list.types'
import type { Versioned } from '../../../shared/types/persistence.types'

export interface RankingRepository {
    getAll(): Promise<Versioned<RankingList>[]>
}