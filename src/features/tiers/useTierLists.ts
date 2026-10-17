import { useEffect, useRef, useState } from 'react'
import type { CatalogItem, CatalogRepository } from '../catalog'
import type { ProfileImageStore } from '../images/model/profileImageStore'
import type { TierList } from '../../shared/types/list.types'
import type { Versioned } from '../../shared/types/persistence.types'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { moveTierEntry, sameTierOrder } from './tier.repository'
import type {
    AddTierEntryInput,
    CreateTierListInput,
    TierEntryDraft,
    TierRepository,
} from './tier.repository'

type Records = {
    lists: Versioned<TierList>[]
    items: Versioned<CatalogItem>[]
}

async function readRecords(
    repository: TierRepository,
    catalog: CatalogRepository,
): Promise<Records> {
    const lists = await repository.getAll()
    const items = await catalog.getAll()
    const known = new Set(items.map((item) => item.value.id))

    if (lists.some((list) =>
        list.value.entries.some((entry) => !known.has(entry.itemId)),
    )) {
        throw new Error('Ein referenziertes Profil fehlt.')
    }

    return { lists, items }
}

function upsert<T extends { id: string }>(
    records: readonly Versioned<T>[],
    saved: Versioned<T>,
) {
    return records.some((item) => item.value.id === saved.value.id)
        ? records.map((item) =>
            item.value.id === saved.value.id ? saved : item,
        )
        : [saved, ...records]
}

export function useTierLists(
    repository: TierRepository,
    catalog: CatalogRepository,
    imageStore: ProfileImageStore,
) {
    const [records, setRecords] = useState<Records>({
        lists: [],
        items: [],
    })

    const recordsRef = useRef<Records>({
        lists: [],
        items: [],
    })

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [needsReload, setNeedsReload] = useState(true)
    const [error, setError] = useState('')
    const [loadRequest, setLoadRequest] = useState(0)

    const generation = useRef(0)
    const busy = useRef(true)
    const blocked = useRef(true)

    function accept(loaded: Records) {
        recordsRef.current = loaded
        setRecords(loaded)
    }

    useEffect(() => {
        const current = ++generation.current
        busy.current = true

        async function load() {
            try {
                const loaded = await readRecords(repository, catalog)

                if (current !== generation.current) return

                accept(loaded)
                setHasLoaded(true)
                setError('')
                setNeedsReload(false)
                blocked.current = false

                void imageStore.cleanupUnused().catch((cause) => {
                    console.warn('[deluLu] Photo cleanup failed:', cause)
                })
            } catch {
                if (current === generation.current) {
                    setError('Die Tierlisten konnten nicht geladen werden.')
                    setNeedsReload(true)
                    blocked.current = true
                }
            } finally {
                if (current === generation.current) {
                    busy.current = false
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => {
            generation.current += 1
        }
    }, [repository, catalog, imageStore, loadRequest])

    function reload() {
        if (busy.current) return

        busy.current = true
        blocked.current = true
        setIsLoading(true)
        setLoadRequest((value) => value + 1)
    }

    async function create(
        input: CreateTierListInput,
    ): Promise<string | null> {
        if (busy.current || blocked.current) return null

        busy.current = true
        setIsSaving(true)

        const current = generation.current

        try {
            const saved = await repository.create(input)

            if (current !== generation.current) return null

            accept({
                ...recordsRef.current,
                lists: upsert(recordsRef.current.lists, saved),
            })

            return saved.value.id
        } finally {
            if (current === generation.current) {
                busy.current = false
                setIsSaving(false)
            }
        }
    }

    async function addEntry(
        listId: string,
        draft: TierEntryDraft,
    ): Promise<boolean> {
        if (busy.current || blocked.current) return false

        const stored = recordsRef.current.lists.find(
            (list) => list.value.id === listId,
        )

        if (!stored) return false

        busy.current = true
        setIsSaving(true)
        setError('')

        const current = generation.current
        let attempted = false

        try {
            const input: AddTierEntryInput = {
                id: draft.id,
                listId,
                itemId: draft.itemId,
                expectedRevision: stored.revision,
            }

            if (draft.source === 'new') {
                input.newProfile = {
                    name: draft.name.trim(),
                    profileImageId: draft.photo
                        ? await imageStore.upload(draft.photo)
                        : null,
                }
            }

            if (current !== generation.current) return false

            attempted = true

            const result = await repository.addEntry(input)

            if (current !== generation.current) return false

            accept({
                lists: upsert(recordsRef.current.lists, result.list),
                items: upsert(recordsRef.current.items, result.item),
            })

            return true
        } catch (cause) {
            if (current !== generation.current) return false
            if (!attempted) throw cause

            try {
                const recovered = await readRecords(repository, catalog)

                if (current !== generation.current) return false

                const saved = recovered.lists
                    .find((list) => list.value.id === listId)
                    ?.value.entries.some((entry) =>
                        entry.id === draft.id &&
                        entry.itemId === draft.itemId,
                    )

                if (saved) {
                    accept(recovered)
                    return true
                }
            } catch {
                // Keep the draft until the current state can be loaded.
            }

            if (current !== generation.current) return false

            setError(
                cause instanceof RevisionConflictError
                    ? 'Die Tierliste wurde inzwischen geändert. Bitte lade den aktuellen Stand.'
                    : 'Speichern konnte nicht bestätigt werden. Bitte lade den aktuellen Stand.',
            )

            blocked.current = true
            setNeedsReload(true)

            return false
        } finally {
            if (current === generation.current) {
                busy.current = false
                setIsSaving(false)
            }
        }
    }

    async function moveEntry(
        listId: string,
        entryId: string,
        tierId: string | null,
        index: number,
    ) {
        if (busy.current || blocked.current) return

        const stored = recordsRef.current.lists.find(
            (list) => list.value.id === listId,
        )

        if (!stored) return

        const moved = moveTierEntry(
            stored.value,
            entryId,
            tierId,
            index,
        )

        if (sameTierOrder(stored.value, moved)) return

        busy.current = true
        setIsSaving(true)
        setError('')

        const current = generation.current

        accept({
            ...recordsRef.current,
            lists: upsert(recordsRef.current.lists, {
                ...stored,
                value: moved,
            }),
        })

        try {
            const saved = await repository.moveEntry({
                listId,
                entryId,
                tierId,
                index,
                expectedRevision: stored.revision,
            })

            if (current !== generation.current) return

            accept({
                ...recordsRef.current,
                lists: upsert(recordsRef.current.lists, saved),
            })
        } catch (cause) {
            if (current !== generation.current) return

            try {
                const recovered = await readRecords(repository, catalog)

                if (current !== generation.current) return

                accept(recovered)

                const saved = recovered.lists.find(
                    (list) => list.value.id === listId,
                )

                if (saved && sameTierOrder(saved.value, moved)) return
            } catch {
                if (current !== generation.current) return

                accept({
                    ...recordsRef.current,
                    lists: upsert(recordsRef.current.lists, stored),
                })
            }

            setError(
                cause instanceof RevisionConflictError
                    ? 'Die Tierliste wurde inzwischen geändert. Bitte lade den aktuellen Stand.'
                    : 'Die Verschiebung konnte nicht bestätigt werden. Bitte lade den aktuellen Stand.',
            )

            blocked.current = true
            setNeedsReload(true)
        } finally {
            if (current === generation.current) {
                busy.current = false
                setIsSaving(false)
            }
        }
    }

    return {
        lists: records.lists.map((record) => record.value),
        items: records.items.map((record) => record.value),
        isLoading,
        isSaving,
        hasLoaded,
        needsReload,
        error,
        reload,
        create,
        addEntry,
        moveEntry,
    }
}