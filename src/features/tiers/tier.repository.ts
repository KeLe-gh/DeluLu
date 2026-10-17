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
    | { source: 'new'; name: string; photo: Blob | null }
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

export interface MoveTierEntryInput {
    listId: string
    entryId: string
    tierId: string | null
    index: number
    expectedRevision: number
}

export function moveTierEntry(
    list: TierList,
    entryId: string,
    tierId: string | null,
    index: number,
): TierList {
    const entry = list.entries.find((item) => item.id === entryId)

    if (
        !entry ||
        (tierId !== null && !list.tiers.some((tier) => tier.id === tierId))
    ) {
        return list
    }

    const remaining = list.entries.filter((item) => item.id !== entryId)
    const target = remaining.filter((item) => item.tierId === tierId)

    if (!Number.isInteger(index) || index < 0 || index > target.length) {
        return list
    }

    const anchor = target[index]
    const previous = target.at(-1)

    const position = anchor
        ? remaining.indexOf(anchor)
        : previous
            ? remaining.indexOf(previous) + 1
            : remaining.length

    remaining.splice(position, 0, { ...entry, tierId })

    return { ...list, entries: remaining }
}

export function sameTierOrder(a: TierList, b: TierList): boolean {
    return (
        a.entries.length === b.entries.length &&
        [null, ...a.tiers.map((tier) => tier.id)].every((tierId) =>
            a.entries
                .filter((entry) => entry.tierId === tierId)
                .map((entry) => entry.id)
                .join(',') ===
            b.entries
                .filter((entry) => entry.tierId === tierId)
                .map((entry) => entry.id)
                .join(','),
        )
    )
}

export interface TierRepository {
    getAll(): Promise<Versioned<TierList>[]>
    create(input: CreateTierListInput): Promise<Versioned<TierList>>
    addEntry(input: AddTierEntryInput): Promise<TierEntrySaveResult>
    moveEntry(input: MoveTierEntryInput): Promise<Versioned<TierList>>
}