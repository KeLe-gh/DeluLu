import { useEffect, useRef, useState } from 'react'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import type {
    MediaDraft,
    MediaRepository,
    MediaStatus,
    MediaTitle,
} from './media.types'
import { sameMediaTitle } from './media.types'
import { moveMedia, sameMediaOrder } from './mediaOrder'

export function useMediaTitles(repository: MediaRepository) {
    const [titles, setTitles] = useState<MediaTitle[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loaded, setLoaded] = useState(false)
    const [needsReload, setNeedsReload] = useState(false)
    const [request, setRequest] = useState(0)

    const busy = useRef(false)
    const generation = useRef(0)

    useEffect(() => {
        const run = ++generation.current

        async function load() {
            try {
                const rows = await repository.getAll()

                if (generation.current !== run) return

                setTitles(rows)
                setLoaded(true)
                setNeedsReload(false)
                setError('')
            } catch {
                if (generation.current === run) {
                    setError(
                        'Serien und Filme konnten nicht geladen werden.',
                    )
                    setNeedsReload(true)
                }
            } finally {
                if (generation.current === run) {
                    setLoading(false)
                }
            }
        }

        void load()

        return () => {
            generation.current += 1
        }
    }, [repository, request])

    function reload() {
        if (loading || busy.current) return

        setLoading(true)
        setError('')
        setRequest((value) => value + 1)
    }

    async function mutate(
        operation: () => Promise<
            (rows: MediaTitle[]) => MediaTitle[]
        >,
        confirmed: (rows: MediaTitle[]) => boolean,
    ) {
        if (loading || needsReload || busy.current) {
            return false
        }

        const run = generation.current

        busy.current = true
        setSaving(true)
        setError('')

        try {
            const accept = await operation()

            if (run !== generation.current) return false

            setTitles(accept)
            return true
        } catch (cause) {
            if (run !== generation.current) return false

            console.error('[deluLu] Media change failed:', cause)

            try {
                const rows = await repository.getAll()

                if (run !== generation.current) return false

                setTitles(rows)

                if (confirmed(rows)) return true
            } catch {
                if (run !== generation.current) return false

                setNeedsReload(true)
            }

            setError(
                cause instanceof RevisionConflictError
                    ? 'Die Daten wurden inzwischen geändert. Bitte prüfe den aktuellen Stand und öffne ein bereits offenes Popup erneut.'
                    : 'Die Änderung konnte nicht bestätigt werden. Deine Eingaben bleiben erhalten.',
            )

            return false
        } finally {
            busy.current = false

            if (run === generation.current) {
                setSaving(false)
            }
        }
    }

    function save(
        draft: MediaDraft,
        revision: number | null,
    ) {
        return mutate(
            async () => {
                const saved = await repository.save(draft, revision)

                return (rows) => [
                    ...rows.filter((row) => row.id !== saved.id),
                    saved,
                ]
            },
            (rows) =>
                rows.some((row) => sameMediaTitle(row, draft)),
        )
    }

    function remove(title: MediaTitle) {
        return mutate(
            async () => {
                await repository.remove(title)

                return (rows) =>
                    rows.filter((row) => row.id !== title.id)
            },
            (rows) =>
                !rows.some((row) => row.id === title.id),
        )
    }

    function reorder(
        status: MediaStatus,
        id: string,
        index: number,
    ) {
        const current = titles.filter(
            (row) => row.status === status,
        )
        const desired = moveMedia(current, id, index)

        if (sameMediaOrder(current, desired)) {
            return Promise.resolve(true)
        }

        return mutate(
            async () => {
                const saved = await repository.reorder(
                    status,
                    desired,
                )

                return (rows) => [
                    ...rows.filter((row) => row.status !== status),
                    ...saved,
                ]
            },
            (rows) => sameMediaOrder(
                rows.filter((row) => row.status === status),
                desired,
            ),
        )
    }

    return {
        titles,
        loading,
        saving,
        loaded,
        error,
        needsReload,
        reload,
        save,
        remove,
        reorder,
    }
}