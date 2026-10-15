import type {
    EntryId,
    IsoDateTime,
    ItemId,
    ListId,
    RankingList,
    RankingListEntry,
} from '../../../shared/types/list.types'

interface CreateRankingListInput {
    id: ListId
    title: string
    timestamp: IsoDateTime
}

interface AddRankingEntryInput {
    id: EntryId
    itemId: ItemId
    position: number
    timestamp: IsoDateTime
}

interface MoveRankingEntryInput {
    entryId: EntryId
    position: number
    timestamp: IsoDateTime
}

export function createRankingList(
    input: CreateRankingListInput,
): RankingList | null {
    const title = input.title.trim()

    if (title === '') {
        return null
    }

    return {
        id: input.id,
        title,
        description: '',
        kind: 'ranking',
        entries: [],
        coverImageId: null,
        appearance: {
            themeId: 'default',
            accentColor: null,
            backgroundImageId: null,
        },
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
    }
}

export function getRankingSize(list: RankingList): number {
    return list.entries.reduce(
        (highest, entry) => Math.max(highest, entry.position),
        0,
    )
}

function placeRankingEntry(
    entries: readonly RankingListEntry[],
    entry: RankingListEntry,
): RankingListEntry[] | null {
    if (
        !Number.isSafeInteger(entry.position) ||
        entry.position < 1
    ) {
        return null
    }

    const positionOccupied = entries.some(
        (existing) => existing.position === entry.position,
    )

    const cannotShift = positionOccupied && entries.some(
        (existing) =>
            existing.position >= entry.position &&
            existing.position === Number.MAX_SAFE_INTEGER,
    )

    if (cannotShift) {
        return null
    }

    const shiftedEntries = entries.map((existing) => {
        if (
            positionOccupied &&
            existing.position >= entry.position
        ) {
            return {
                ...existing,
                position: existing.position + 1,
            }
        }

        return existing
    })

    return [...shiftedEntries, entry].sort(
        (a, b) => a.position - b.position,
    )
}

export function addRankingEntry(
    list: RankingList,
    input: AddRankingEntryInput,
): RankingList | null {
    const alreadyExists = list.entries.some(
        (entry) =>
            entry.id === input.id ||
            entry.itemId === input.itemId,
    )

    if (alreadyExists) {
        return null
    }

    const entries = placeRankingEntry(list.entries, {
        id: input.id,
        itemId: input.itemId,
        note: '',
        position: input.position,
    })

    if (entries === null) {
        return null
    }

    return {
        ...list,
        entries,
        updatedAt: input.timestamp,
    }
}

export function moveRankingEntry(
    list: RankingList,
    input: MoveRankingEntryInput,
): RankingList | null {
    const entry = list.entries.find(
        (existing) => existing.id === input.entryId,
    )

    if (!entry) {
        return null
    }

    const remainingEntries = list.entries.filter(
        (existing) => existing.id !== input.entryId,
    )

    const entries = placeRankingEntry(remainingEntries, {
        ...entry,
        position: input.position,
    })

    if (entries === null) {
        return null
    }

    return {
        ...list,
        entries,
        updatedAt: input.timestamp,
    }
}
interface RemoveRankingEntryInput {
    entryId: EntryId
    timestamp: IsoDateTime
}

export function removeRankingEntry(
    list: RankingList,
    input: RemoveRankingEntryInput,
): RankingList | null {
    const exists = list.entries.some(
        (entry) => entry.id === input.entryId,
    )

    if (!exists) {
        return null
    }

    return {
        ...list,
        entries: list.entries.filter(
            (entry) => entry.id !== input.entryId,
        ),
        updatedAt: input.timestamp,
    }
}
interface ReorderRankingEntriesInput {
    entryId: EntryId
    toIndex: number
    timestamp: IsoDateTime
}

export function reorderRankingEntries(
    list: RankingList,
    input: ReorderRankingEntriesInput,
): RankingList | null {
    const orderedEntries = [...list.entries].sort(
        (a, b) => a.position - b.position,
    )

    const fromIndex = orderedEntries.findIndex(
        (entry) => entry.id === input.entryId,
    )

    if (
        fromIndex < 0 ||
        !Number.isInteger(input.toIndex) ||
        input.toIndex < 0 ||
        input.toIndex >= orderedEntries.length
    ) {
        return null
    }

    if (fromIndex === input.toIndex) {
        return list
    }

    const positions = orderedEntries.map(
        (entry) => entry.position,
    )

    const [movedEntry] = orderedEntries.splice(fromIndex, 1)

    if (!movedEntry) {
        return null
    }

    orderedEntries.splice(input.toIndex, 0, movedEntry)

    return {
        ...list,
        entries: orderedEntries.map((entry, index) => ({
            ...entry,
            position: positions[index],
        })),
        updatedAt: input.timestamp,
    }
}