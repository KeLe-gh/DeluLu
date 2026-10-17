import { useEffect, useRef, useState } from 'react'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import type {
    MediaDraft,
    MediaRepository,
    MediaTitle,
} from './media.types'
import { sameMediaTitle } from './media.types'

export function useMediaTitles(repository: MediaRepository) {
    const [titles, setTitles] = useState<MediaTitle[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loaded, setLoaded] = useState(false)
    const [needsReload, setNeedsReload] = useState(false)
    const [request, setRequest] = useState(0)

    const savingRef = useRef(false)
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
        if (loading || savingRef.current) return

        setLoading(true)
        setError('')
        setRequest((value) => value + 1)
    }

    async function save(
        draft: MediaDraft,
        revision: number | null,
    ) {
        if (savingRef.current || loading || needsReload) {
            return false
        }

        savingRef.current = true
        setSaving(true)
        setError('')

        const run = generation.current

        try {
            const saved = await repository.save(draft, revision)

            if (run !== generation.current) return false

            setTitles((rows) => [
                ...rows.filter((row) => row.id !== saved.id),
                saved,
            ])

            return true
        } catch (cause) {
            if (run !== generation.current) return false

            console.error('[deluLu] Media save failed:', cause)

            try {
                const rows = await repository.getAll()

                if (run !== generation.current) return false

                setTitles(rows)

                const current = rows.find(
                    (row) => row.id === draft.id,
                )

                if (current && sameMediaTitle(current, draft)) {
                    return true
                }
            } catch {
                if (run !== generation.current) return false

                setNeedsReload(true)
            }

            setError(
                cause instanceof RevisionConflictError
                    ? 'Der Eintrag wurde inzwischen geändert. Bitte schliesse das Popup und öffne ihn erneut.'
                    : 'Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten.',
            )

            return false
        } finally {
            savingRef.current = false

            if (run === generation.current) {
                setSaving(false)
            }
        }
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
    }
}