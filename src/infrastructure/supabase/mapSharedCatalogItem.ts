import { mapCatalogItem } from './database.mappers'

type CatalogRow = Parameters<typeof mapCatalogItem>[0]

export function mapSharedCatalogItem(row: CatalogRow) {
    const item = mapCatalogItem(row).value

    return {
        ...item,
        profileImageId: item.profileImageId
            ? `${row.owner_id}/${item.profileImageId}`
            : null,
        backgroundImageId: item.backgroundImageId
            ? `${row.owner_id}/${item.backgroundImageId}`
            : null,
    }
}