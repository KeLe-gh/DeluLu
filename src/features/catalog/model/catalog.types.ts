import type {
    ImageId,
    IsoDateTime,
    ItemId,
} from '../../../shared/types/list.types'

export interface CatalogItem {
    id: ItemId
    name: string
    description: string
    profileImageId: ImageId | null
    backgroundImageId: ImageId | null
    createdAt: IsoDateTime
    updatedAt: IsoDateTime
}