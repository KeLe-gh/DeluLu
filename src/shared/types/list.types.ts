export type ListId = string
export type EntryId = string
export type ItemId = string
export type TierId = string
export type ImageId = string
export type IsoDateTime = string

export interface ListEntry {
    id: EntryId
    itemId: ItemId
    note: string
}
export interface RankingListEntry extends ListEntry {
    position: number
}

export interface ListAppearance {
    themeId: string
    accentColor: string | null
    backgroundImageId: ImageId | null
}

interface ListBase {
    id: ListId
    title: string
    description: string
    coverImageId: ImageId | null
    appearance: ListAppearance
    createdAt: IsoDateTime
    updatedAt: IsoDateTime
}

export interface RankingList extends ListBase {
    kind: 'ranking'
    entries: RankingListEntry[]
}

export interface Tier {
    id: TierId
    label: string
    color: string
}

export interface TierListEntry extends ListEntry {
    tierId: TierId | null
}

export interface TierList extends ListBase {
    kind: 'tier'
    styleId: string
    tiers: Tier[]
    entries: TierListEntry[]
}

export type DeluluList = RankingList | TierList