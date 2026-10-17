import { useEffect, useRef, useState } from 'react'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import type {
    MediaThought,
    MediaThoughtDraft,
    MediaThoughtRepository,
} from './mediaThought.types'
import { sameThought } from './mediaThought.types'

export function useMediaThoughts(
    titleId: string,
    repository: MediaThoughtRepository,
) {
    const [thoughts, setThoughts] = useState<MediaThought[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [needsReload, setNeedsReload] = useState(false)
    const [request, setRequest] = useState(0)

    const generation = useRef(0)
    const busy = useRef(false)

    useEffect(() => {
        const run = ++generation.current

        async function load() {
            try {
                const rows = await repository.getAll(titleId)

                if (run !== generation.current) return

                setThoughts(rows)
                setNeedsReload(false)
                setError('')
            } catch {
                if (run === generation.current) {
                    setError('Gedanken konnten nicht geladen werden.')
                    setNeedsReload(true)
                }
            } finally {
                if (run === generation.current) {
                    setLoading(false)
                }
            }
        }

        void load()

        return () => {
            generation.current += 1
        }
    }, [titleId, repository, request])

    function reload() {
        if (loading || busy.current) return

        setLoading(true)
        setError('')
        setRequest((value) => value + 1)
    }

    async function mutate(
        operation: () => Promise<
            (rows: MediaThought[]) => MediaThought[]
        >,
        confirmed: (rows: MediaThought[]) => boolean,
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

            setThoughts(accept)
            return true
        } catch (cause) {
            if (run !== generation.current) return false

            console.error('[deluLu] Thought change failed:', cause)

            try {
                const rows = await repository.getAll(titleId)

                if (run !== generation.current) return false

                setThoughts(rows)

                if (confirmed(rows)) return true
            } catch {
                if (run !== generation.current) return false

                setNeedsReload(true)
            }

            setError(
                cause instanceof RevisionConflictError
                    ? 'Der Gedanke wurde inzwischen geändert. Bitte schliesse das Popup und öffne ihn erneut.'
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
        draft: MediaThoughtDraft,
        revision: number | null,
    ) {
        if (draft.titleId !== titleId) {
            return Promise.resolve(false)
        }

        return mutate(
            async () => {
                const saved = await repository.save(draft, revision)

                return (rows) => [
                    ...rows.filter((row) => row.id !== saved.id),
                    saved,
                ]
            },
            (rows) => rows.some((row) => sameThought(row, draft)),
        )
    }

    function remove(thought: MediaThought) {
        if (thought.titleId !== titleId) {
            return Promise.resolve(false)
        }

        return mutate(
            async () => {
                await repository.remove(thought)

                return (rows) =>
                    rows.filter((row) => row.id !== thought.id)
            },
            (rows) => !rows.some((row) => row.id === thought.id),
        )
    }

    return {
        thoughts,
        loading,
        saving,
        error,
        needsReload,
        reload,
        save,
        remove,
    }
}