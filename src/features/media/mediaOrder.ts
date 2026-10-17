export interface OrderedMedia {
    id: string
    revision: number
    sortOrder: number
}

export function orderedMedia<T extends OrderedMedia>(
    items: readonly T[],
): T[] {
    return [...items].sort(
        (a, b) =>
            a.sortOrder - b.sortOrder ||
            a.id.localeCompare(b.id),
    )
}

export function moveMedia<T extends OrderedMedia>(
    items: readonly T[],
    id: string,
    index: number,
): T[] {
    const ordered = orderedMedia(items)
    const item = ordered.find((row) => row.id === id)

    if (
        !item ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= ordered.length
    ) {
        return ordered
    }

    const result = ordered.filter((row) => row.id !== id)
    result.splice(index, 0, item)

    return result
}

export function sameMediaOrder(
    actual: readonly OrderedMedia[],
    desired: readonly OrderedMedia[],
) {
    return orderedMedia(actual).map((row) => row.id).join(',') ===
        desired.map((row) => row.id).join(',')
}