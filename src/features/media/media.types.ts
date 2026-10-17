export const mediaStatuses = [
    'watchlist',
    'watching',
    'watched',
    'dropped',
] as const

export type MediaStatus = typeof mediaStatuses[number]
export type MediaKind = 'series' | 'movie'

export const mediaStatusLabels: Record<MediaStatus, string> = {
    watchlist: 'Watchlist',
    watching: 'Am Schauen',
    watched: 'Gesehen',
    dropped: 'Dropped',
}

export interface MediaDraft {
    id: string
    name: string
    kind: MediaKind
    status: MediaStatus
    rating: number | null
}

export interface MediaTitle extends MediaDraft {
    sortOrder: number
    revision: number
    createdAt: string
    updatedAt: string
}

export interface MediaRepository {
    reorder: (
        status: MediaStatus,
        items: readonly MediaTitle[],
    ) => Promise<MediaTitle[]>
    remove: (title: MediaTitle) => Promise<void>
    getAll: () => Promise<MediaTitle[]>
    save: (
        draft: MediaDraft,
        expectedRevision: number | null,
    ) => Promise<MediaTitle>
}

export function mediaStatusFromPath(path: string): MediaStatus {
    return mediaStatuses.find(
        (status) => status === path.split('/')[2],
    ) ?? 'watchlist'
}

export function sameMediaTitle(a: MediaDraft, b: MediaDraft) {
    return a.id === b.id &&
        a.name.trim() === b.name.trim() &&
        a.kind === b.kind &&
        a.status === b.status &&
        a.rating === b.rating
}