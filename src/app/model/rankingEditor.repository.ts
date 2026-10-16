import type { CatalogItem } from '../../features/catalog'
import type { RankingList } from '../../shared/types/list.types'
import type { Versioned } from '../../shared/types/persistence.types'

export interface SaveRankingInput {
    list: RankingList
    expectedRevision: number | null

    catalogChange?: {
        item: CatalogItem
        expectedRevision: number | null
    }
}

export interface RankingSaveResult {
    list: Versioned<RankingList>
    catalogItem: Versioned<CatalogItem> | null
}

export interface RankingEditorRepository {
    save(input: SaveRankingInput): Promise<RankingSaveResult>
}