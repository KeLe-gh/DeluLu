export interface MediaThoughtDraft {
    id: string
    titleId: string
    heading: string
    body: string
}

export interface MediaThought extends MediaThoughtDraft {
    revision: number
    createdAt: string
    updatedAt: string
}

export interface MediaThoughtRepository {
    getAll: (titleId: string) => Promise<MediaThought[]>
    save: (
        draft: MediaThoughtDraft,
        revision: number | null,
    ) => Promise<MediaThought>
    remove: (thought: MediaThought) => Promise<void>
}

export function sameThought(
    a: MediaThoughtDraft,
    b: MediaThoughtDraft,
) {
    return a.id === b.id &&
        a.titleId === b.titleId &&
        a.heading.trim() === b.heading.trim() &&
        a.body.trim() === b.body.trim()
}