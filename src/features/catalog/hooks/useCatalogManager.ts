import { useEffect, useRef, useState } from 'react'
import type { Versioned } from '../../../shared/types/persistence.types'
import { RevisionConflictError } from '../../../shared/errors/persistence.errors'
import type { ProfileImageStore } from '../../images/model/profileImageStore'
import type { CatalogItem } from '../model/catalog.types'
import type {
    CatalogManagerRepository,
    CatalogProfileDraft,
} from '../model/catalogManager.repository'
import { createCatalogItem } from '../model/catalog.operations'

function matches(a: CatalogItem, b: CatalogItem) {
    return (
        a.id === b.id &&
        a.name === b.name &&
        a.description === b.description &&
        a.profileImageId === b.profileImageId &&
        a.backgroundImageId === b.backgroundImageId
    )
}

export function useCatalogManager(
    repository: CatalogManagerRepository,
    imageStore: ProfileImageStore,
) {
    const [items, setItems] = useState<Versioned<CatalogItem>[]>([])
    const records = useRef<Versioned<CatalogItem>[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [needsReload, setNeedsReload] = useState(true)
    const [error, setError] = useState('')
    const [request, setRequest] = useState(0)

    const generation = useRef(0)
    const busy = useRef(true)
    const blocked = useRef(true)

    function accept(value: Versioned<CatalogItem>[]) {
        records.current = value
        setItems(value)
    }

    function cleanup() {
        void imageStore.cleanupUnused().catch((cause) => {
            console.warn('[deluLu] Photo cleanup failed:', cause)
        })
    }

    useEffect(() => {
        const current = ++generation.current
        busy.current = true

        async function load() {
            try {
                const loaded = await repository.getAll()

                if (current !== generation.current) return

                accept(loaded)
                setHasLoaded(true)
                setNeedsReload(false)
                blocked.current = false
                setError('')

                void imageStore.cleanupUnused().catch((cause) => {
                    console.warn('[deluLu] Photo cleanup failed:', cause)
                })
            } catch {
                if (current === generation.current) {
                    setError('Der Katalog konnte nicht geladen werden.')
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
    }, [repository, imageStore, request])

    function reload() {
        if (busy.current) return

        busy.current = true
        blocked.current = true
        setIsLoading(true)
        setRequest((value) => value + 1)
    }

    async function save(
        draft: CatalogProfileDraft,
        isNew: boolean,
    ): Promise<boolean> {
        if (busy.current || blocked.current) return false

        const stored = records.current.find(
            (item) => item.value.id === draft.id,
        )

        const base = isNew
            ? createCatalogItem({
                id: draft.id,
                name: draft.name,
                timestamp: new Date().toISOString(),
            })
            : stored?.value

        if (!base || (!isNew && !stored)) return false

        busy.current = true
        setIsSaving(true)
        setError('')

        const current = generation.current
        let attempted = false
        let desired: CatalogItem | null = null

        try {
            desired = {
                ...base,
                name: draft.name.trim(),
                updatedAt: new Date().toISOString(),
            }

            if (draft.photo !== undefined) {
                desired.profileImageId = draft.photo
                    ? await imageStore.upload(draft.photo)
                    : null
            }

            if (draft.background !== undefined) {
                desired.backgroundImageId = draft.background
                    ? await imageStore.upload(draft.background)
                    : null
            }

            if (current !== generation.current) return false

            attempted = true

            const saved = await repository.save(
                desired,
                isNew ? null : stored!.revision,
            )

            if (current !== generation.current) return false

            accept([
                ...records.current.filter(
                    (item) => item.value.id !== saved.value.id,
                ),
                saved,
            ])

            cleanup()
            return true
        } catch (cause) {
            if (current !== generation.current) return false
            if (!attempted) throw cause

            try {
                const recovered = await repository.getAll()

                if (current !== generation.current) return false

                accept(recovered)

                if (
                    desired &&
                    recovered.some((item) =>
                        matches(item.value, desired!),
                    )
                ) {
                    cleanup()
                    return true
                }
            } catch {
                // Preserve the draft until reload succeeds.
            }

            if (current !== generation.current) return false

            blocked.current = true
            setNeedsReload(true)
            setError(
                cause instanceof RevisionConflictError
                    ? 'Das Profil wurde inzwischen geändert. Bitte lade den aktuellen Stand.'
                    : 'Speichern konnte nicht bestätigt werden. Bitte lade den aktuellen Stand.',
            )

            return false
        } finally {
            if (current === generation.current) {
                busy.current = false
                setIsSaving(false)
            }
        }
    }

    async function remove(id: string): Promise<boolean> {
        if (busy.current || blocked.current) return false

        const stored = records.current.find(
            (item) => item.value.id === id,
        )

        if (!stored) return true

        busy.current = true
        setIsSaving(true)
        setError('')

        const current = generation.current

        try {
            await repository.remove(id, stored.revision)

            if (current !== generation.current) return false

            accept(
                records.current.filter(
                    (item) => item.value.id !== id,
                ),
            )

            cleanup()
            return true
        } catch (cause) {
            if (current !== generation.current) return false

            try {
                const recovered = await repository.getAll()

                if (current !== generation.current) return false

                accept(recovered)

                if (!recovered.some((item) => item.value.id === id)) {
                    cleanup()
                    return true
                }
            } catch {
                // Keep the profile visible until deletion is confirmed.
            }

            if (current !== generation.current) return false

            blocked.current = true
            setNeedsReload(true)
            setError(
                cause instanceof RevisionConflictError
                    ? 'Das Profil oder eine Liste wurde inzwischen geändert. Bitte lade den aktuellen Stand.'
                    : 'Löschen konnte nicht bestätigt werden. Bitte lade den aktuellen Stand.',
            )

            return false
        } finally {
            if (current === generation.current) {
                busy.current = false
                setIsSaving(false)
            }
        }
    }

    return {
        items,
        isLoading,
        isSaving,
        hasLoaded,
        needsReload,
        error,
        reload,
        save,
        remove,
    }
}