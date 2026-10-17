import { useEffect, useRef, useState } from 'react'
import type { Versioned } from '../../shared/types/persistence.types'
import type { ProfileImageStore } from '../images/model/profileImageStore'
import type {
    AppAppearance,
    AppearanceRepository,
} from './appearance.repository'

export function useAppAppearance(
    repository: AppearanceRepository,
    imageStore: ProfileImageStore,
) {
    const [stored, setStored] =
        useState<Versioned<AppAppearance> | null>(null)

    const storedRef =
        useRef<Versioned<AppAppearance> | null>(null)

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [needsReload, setNeedsReload] = useState(true)
    const [error, setError] = useState('')
    const [loadRequest, setLoadRequest] = useState(0)

    const generation = useRef(0)
    const busy = useRef(true)
    const blocked = useRef(true)

    useEffect(() => {
        const current = ++generation.current
        busy.current = true

        async function load() {
            try {
                const result = await repository.load()

                if (current !== generation.current) return

                storedRef.current = result
                setStored(result)
                setHasLoaded(true)
                setNeedsReload(false)
                blocked.current = false
                setError('')
            } catch {
                if (current !== generation.current) return

                setError(
                    'Der App-Hintergrund konnte nicht geladen werden.',
                )
                setNeedsReload(true)
                blocked.current = true
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
        blocked.current = true
        setIsLoading(true)
        setLoadRequest((value) => value + 1)
    }

    async function save(photo: Blob | null): Promise<boolean> {
        if (busy.current || blocked.current) return false

        busy.current = true
        setIsSaving(true)
        setError('')

        const current = generation.current
        let writeAttempted = false

        try {
            const imageId = photo === null
                ? null
                : await imageStore.upload(photo)

            if (current !== generation.current) return false

            writeAttempted = true

            const result = await repository.save(
                { backgroundImageId: imageId },
                storedRef.current?.revision ?? null,
            )

            if (current !== generation.current) return false

            storedRef.current = result
            setStored(result)

            void imageStore.cleanupUnused().catch((cause) => {
                console.warn(
                    '[deluLu] Photo cleanup failed:',
                    cause,
                )
            })

            return true
        } catch {
            if (current !== generation.current) return false

            setError(
                writeAttempted
                    ? 'Speichern fehlgeschlagen. Bitte lade den aktuellen Stand und versuche es erneut.'
                    : 'Das Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.',
            )

            if (writeAttempted) {
                blocked.current = true
                setNeedsReload(true)
            }

            return false
        } finally {
            if (current === generation.current) {
                busy.current = false
                setIsSaving(false)
            }
        }
    }

    return {
        imageId: stored?.value.backgroundImageId ?? null,
        isLoading,
        isSaving,
        hasLoaded,
        needsReload,
        error,
        reload,
        save,
    }
}