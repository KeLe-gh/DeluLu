import type {
    EntryId,
    IsoDateTime,
    ItemId,
    ListId,
    RankingList,
} from '../../../shared/types/list.types'

interface CreateRankingListInput {
    id: ListId
    title: string
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

interface AddRankingEntryInput {
    id: EntryId
    itemId: ItemId
    position: number
    timestamp: IsoDateTime
}

export function addRankingEntry(
    list: RankingList,
    input: AddRankingEntryInput,
): RankingList | null {
    if (
        !Number.isSafeInteger(input.position) ||
        input.position < 1
    ) {
        return null
    }

    const alreadyExists = list.entries.some(
        (entry) =>
            entry.id === input.id ||
            entry.itemId === input.itemId,
    )

    if (alreadyExists) {
        return null
    }

    const positionOccupied = list.entries.some(
        (entry) => entry.position === input.position,
    )

    const cannotShift = positionOccupied && list.entries.some(
        (entry) =>
            entry.position >= input.position &&
            entry.position === Number.MAX_SAFE_INTEGER,
    )

    if (cannotShift) {
        return null
    }

    const existingEntries = list.entries.map((entry) => {
        if (
            positionOccupied &&
            entry.position >= input.position
        ) {
            return {
                ...entry,
                position: entry.position + 1,
            }
        }

        return entry
    })

    return {
        ...list,
        entries: [
            ...existingEntries,
            {
                id: input.id,
                itemId: input.itemId,
                note: '',
                position: input.position,
            },
        ].sort((a, b) => a.position - b.position),
        updatedAt: input.timestamp,
    }
}