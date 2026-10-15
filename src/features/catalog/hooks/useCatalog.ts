import { useState } from 'react'
import type { CatalogItem } from '../model/catalog.types'

export function useCatalog() {
    const [items, setItems] = useState<CatalogItem[]>([])

    function addCatalogItem(item: CatalogItem): void {
        setItems((currentItems) => [...currentItems, item])
    }

    return {
        items,
        addCatalogItem,
    }
}