import type { Versioned } from '../../../shared/types/persistence.types'
import type { CatalogItem } from './catalog.types'

export interface CatalogRepository {
    getAll(): Promise<Versioned<CatalogItem>[]>

    save(
        item: CatalogItem,
        expectedRevision: number | null,
    ): Promise<Versioned<CatalogItem>>
}