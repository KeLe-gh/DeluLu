import { useState } from 'react'
import type { CatalogItem } from '../model/catalog.types'

export function useCatalog() {
    const [items, setItems] = useState<CatalogItem[]>([])

    function addCatalogItem(item: CatalogItem): void {
        setItems((currentItems) => [...currentItems, item])
    }

    function updateCatalogItem(item: CatalogItem): void {
        setItems((currentItems) =>
            currentItems.map((currentItem) =>
                currentItem.id === item.id
                    ? item
                    : currentItem,
            ),
        )
    }

    return {
        items,
        addCatalogItem,
        updateCatalogItem,
    }
}