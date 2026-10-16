import { useEffect, useRef, useState } from 'react'
import {
    createCatalogItem,
    renameCatalogItem,
} from '../../features/catalog'
import type {
    CatalogItem,
    CatalogRepository,
} from '../../features/catalog'
import type {
    RankingRepository,
} from '../../features/rankings'
import {
    addRankingEntry,
    createRankingList,
    moveRankingEntry,
    removeRankingEntry,
    reorderRankingEntries,
} from '../../features/rankings/model/ranking.operations'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import type {
    EntryId,
    ItemId,
    ListId,
    RankingList,
} from '../../shared/types/list.types'
import type {
    Versioned,
} from '../../shared/types/persistence.types'
import type {
    RankingEditorRepository,
    SaveRankingInput,
} from '../model/rankingEditor.repository'

interface WorkspaceDependencies {
    catalogRepository: CatalogRepository
    rankingRepository: RankingRepository
    editorRepository: RankingEditorRepository
}

interface WorkspaceRecords {
    lists: Versioned<RankingList>[]
    items: Versioned<CatalogItem>[]
}

function upsert<T extends { id: string }>(
    records: readonly Versioned<T>[],
    saved: Versioned<T>,
): Versioned<T>[] {
    const exists = records.some(
        (record) => record.value.id === saved.value.id,
    )

    if (!exists) {
        return [...records, saved]
    }

    return records.map((record) =>
        record.value.id === saved.value.id
            ? saved
            : record,
    )
}

async function readRecords(
    catalogRepository: CatalogRepository,
    rankingRepository: RankingRepository,
): Promise<WorkspaceRecords> {
    const lists = await rankingRepository.getAll()
    const items = await catalogRepository.getAll()

    const itemIds = new Set(
        items.map((item) => item.value.id),
    )

    const hasMissingProfile = lists.some((list) =>
        list.value.entries.some(
            (entry) => !itemIds.has(entry.itemId),
        ),
    )

    if (hasMissingProfile) {
        throw new Error('A referenced profile is missing.')
    }

    return { lists, items }
}

export function useRankingWorkspace({
                                        catalogRepository,
                                        rankingRepository,
                                        editorRepository,
                                    }: WorkspaceDependencies) {
    const [records, setRecords] = useState<WorkspaceRecords>({
        lists: [],
        items: [],
    })

    const recordsRef = useRef<WorkspaceRecords>({
        lists: [],
        items: [],
    })

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [needsReload, setNeedsReload] = useState(false)
    const [error, setError] = useState('')
    const [loadRequest, setLoadRequest] = useState(0)

    const busyRef = useRef(true)
    const needsReloadRef = useRef(true)
    const generationRef = useRef(0)

    useEffect(() => {
        const generation = ++generationRef.current
        busyRef.current = true

        async function load() {
            try {
                const loaded = await readRecords(
                    catalogRepository,
                    rankingRepository,
                )

                if (generation !== generationRef.current) {
                    return
                }

                recordsRef.current = loaded
                setRecords(loaded)
                setHasLoaded(true)
                setError('')
                setNeedsReload(false)
                needsReloadRef.current = false
            } catch {
                if (generation !== generationRef.current) {
                    return
                }

                setError(
                    'Die Daten konnten nicht geladen werden. Bitte versuche es erneut.',
                )

                setNeedsReload(true)
                needsReloadRef.current = true
            } finally {
                if (generation === generationRef.current) {
                    busyRef.current = false
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => {
            generationRef.current += 1
        }
    }, [
        catalogRepository,
        rankingRepository,
        loadRequest,
    ])

    function reload(): void {
        if (busyRef.current) {
            return
        }

        busyRef.current = true
        setIsLoading(true)
        setLoadRequest((current) => current + 1)
    }

    async function save(
        buildInput: (
            current: WorkspaceRecords,
        ) => SaveRankingInput | null,
    ): Promise<boolean> {
        if (busyRef.current || needsReloadRef.current) {
            return false
        }

        const generation = generationRef.current

        busyRef.current = true
        setIsSaving(true)
        setError('')

        try {
            const input = buildInput(recordsRef.current)

            if (input === null) {
                setError(
                    'Die Eingaben sind ungültig oder der Eintrag wurde nicht gefunden.',
                )
                return false
            }

            const saved = await editorRepository.save(input)

            if (generation !== generationRef.current) {
                return false
            }

            const current = recordsRef.current

            const next: WorkspaceRecords = {
                lists: upsert(current.lists, saved.list),
                items: saved.catalogItem === null
                    ? current.items
                    : upsert(current.items, saved.catalogItem),
            }

            recordsRef.current = next
            setRecords(next)

            return true
        } catch (saveError) {
            if (generation !== generationRef.current) {
                return false
            }

            needsReloadRef.current = true
            setNeedsReload(true)

            setError(
                saveError instanceof RevisionConflictError
                    ? 'Die gespeicherten Daten wurden geändert. Bitte lade sie erneut und prüfe deine Eingaben.'
                    : 'Das Speichern konnte nicht bestätigt werden. Bitte lade die Daten erneut, bevor du weitere Änderungen machst.',
            )

            return false
        } finally {
            if (generation === generationRef.current) {
                busyRef.current = false
                setIsSaving(false)
            }
        }
    }

    function createList(title: string): Promise<boolean> {
        return save(() => {
            const list = createRankingList({
                id: crypto.randomUUID(),
                title,
                timestamp: new Date().toISOString(),
            })

            return list === null
                ? null
                : { list, expectedRevision: null }
        })
    }

    function addEntry(
        listId: ListId,
        name: string,
        position: number,
    ): Promise<boolean> {
        return save((current) => {
            const storedList = current.lists.find(
                (list) => list.value.id === listId,
            )

            if (!storedList) {
                return null
            }

            const timestamp = new Date().toISOString()

            const item = createCatalogItem({
                id: crypto.randomUUID(),
                name,
                timestamp,
            })

            if (item === null) {
                return null
            }

            const list = addRankingEntry(storedList.value, {
                id: crypto.randomUUID(),
                itemId: item.id,
                position,
                timestamp,
            })

            if (list === null) {
                return null
            }

            return {
                list,
                expectedRevision: storedList.revision,
                catalogChange: {
                    item,
                    expectedRevision: null,
                },
            }
        })
    }

    function updateEntry(
        listId: ListId,
        entryId: EntryId,
        name: string,
        position: number,
    ): Promise<boolean> {
        return save((current) => {
            const storedList = current.lists.find(
                (list) => list.value.id === listId,
            )

            const entry = storedList?.value.entries.find(
                (candidate) => candidate.id === entryId,
            )

            const storedItem = current.items.find(
                (item) => item.value.id === entry?.itemId,
            )

            if (!storedList || !entry || !storedItem) {
                return null
            }

            const timestamp = new Date().toISOString()

            const item = renameCatalogItem(storedItem.value, {
                name,
                timestamp,
            })

            const list = moveRankingEntry(storedList.value, {
                entryId,
                position,
                timestamp,
            })

            if (item === null || list === null) {
                return null
            }

            const input: SaveRankingInput = {
                list,
                expectedRevision: storedList.revision,
            }

            if (item.name !== storedItem.value.name) {
                input.catalogChange = {
                    item,
                    expectedRevision: storedItem.revision,
                }
            }

            return input
        })
    }

    function changeList(
        listId: ListId,
        operation: (list: RankingList) => RankingList | null,
    ): Promise<boolean> {
        return save((current) => {
            const storedList = current.lists.find(
                (list) => list.value.id === listId,
            )

            if (!storedList) {
                return null
            }

            const list = operation(storedList.value)

            return list === null
                ? null
                : {
                    list,
                    expectedRevision: storedList.revision,
                }
        })
    }

    function removeEntry(
        listId: ListId,
        entryId: EntryId,
    ): Promise<boolean> {
        return changeList(listId, (list) =>
            removeRankingEntry(list, {
                entryId,
                timestamp: new Date().toISOString(),
            }),
        )
    }

    function reorderEntry(
        listId: ListId,
        entryId: EntryId,
        toIndex: number,
    ): Promise<boolean> {
        return changeList(listId, (list) =>
            reorderRankingEntries(list, {
                entryId,
                toIndex,
                timestamp: new Date().toISOString(),
            }),
        )
    }

    function getItemName(itemId: ItemId): string {
        return (
            records.items.find(
                (item) => item.value.id === itemId,
            )?.value.name ?? 'Unbekannter Eintrag'
        )
    }

    return {
        lists: records.lists.map((list) => list.value),
        getItemName,
        createList,
        addEntry,
        updateEntry,
        removeEntry,
        reorderEntry,
        reload,
        isLoading,
        isSaving,
        hasLoaded,
        needsReload,
        error,
    }
}