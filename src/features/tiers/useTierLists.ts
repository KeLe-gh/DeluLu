import { useEffect, useRef, useState } from 'react'
import type { TierList } from '../../shared/types/list.types'
import type { Versioned } from '../../shared/types/persistence.types'
import type {
    CreateTierListInput,
    TierRepository,
} from './tier.repository'

export function useTierLists(repository: TierRepository) {
    const [records, setRecords] =
        useState<Versioned<TierList>[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [error, setError] = useState('')
    const [loadRequest, setLoadRequest] = useState(0)

    const generation = useRef(0)
    const busy = useRef(true)

    useEffect(() => {
        const current = ++generation.current
        busy.current = true

        async function load() {
            try {
                const loaded = await repository.getAll()

                if (current !== generation.current) return

                setRecords(loaded)
                setHasLoaded(true)
                setError('')
            } catch {
                if (current === generation.current) {
                    setError(
                        'Die Tierlisten konnten nicht geladen werden.',
                    )
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
    }, [repository, loadRequest])

    function reload() {
        if (busy.current) return

        busy.current = true
        setIsLoading(true)
        setLoadRequest((value) => value + 1)
    }

    async function create(
        input: CreateTierListInput,
    ): Promise<string | null> {
        if (busy.current || !hasLoaded) return null

        busy.current = true
        setIsSaving(true)

        const current = generation.current

        try {
            const saved = await repository.create(input)

            if (current !== generation.current) return null

            setRecords((existing) => [
                saved,
                ...existing.filter(
                    (item) => item.value.id !== saved.value.id,
                ),
            ])

            return saved.value.id
        } finally {
            if (current === generation.current) {
                busy.current = false
                setIsSaving(false)
            }
        }
    }

    return {
        lists: records.map((record) => record.value),
        isLoading,
        isSaving,
        hasLoaded,
        error,
        reload,
        create,
    }
}