import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BackgroundPhoto } from '../images/components/BackgroundPhoto'
import { prepareProfilePhoto } from '../images/model/prepareProfilePhoto'
import type {
    PhotoChange,
    ProfileImageStore,
} from '../images/model/profileImageStore'
import { Modal } from '../../shared/components/Modal'
import type { AppearanceRepository } from './appearance.repository'
import { useAppAppearance } from './useAppAppearance'
import './AppAppearance.css'

type AppearanceState = ReturnType<typeof useAppAppearance>

function AppearanceEditor({
                              appearance,
                              onClose,
                          }: {
    appearance: AppearanceState
    onClose: () => void
}) {
    const inputId = useId()
    const input = useRef<HTMLInputElement>(null)
    const request = useRef(0)

    const [photo, setPhoto] = useState<PhotoChange>(undefined)
    const [preparing, setPreparing] = useState(false)
    const [error, setError] = useState('')

    const busy =
        preparing ||
        appearance.isSaving ||
        appearance.isLoading

    const hasPhoto =
        photo instanceof Blob ||
        (photo === undefined && appearance.imageId !== null)

    useEffect(() => () => {
        request.current += 1
    }, [])

    async function select(file: File) {
        const current = ++request.current

        setPreparing(true)
        setError('')

        try {
            const result = await prepareProfilePhoto(file)

            if (current === request.current) {
                setPhoto(result)
            }
        } catch (cause) {
            if (current === request.current) {
                setError(
                    cause instanceof Error
                        ? cause.message
                        : 'Das Foto konnte nicht geöffnet werden.',
                )
            }
        } finally {
            if (current === request.current) {
                setPreparing(false)
            }
        }
    }

    return (
        <Modal
            title="App-Hintergrund"
            busy={busy}
            onClose={onClose}
        >
            <form onSubmit={(event) => {
                event.preventDefault()

                if (
                    !busy &&
                    photo !== undefined &&
                    !appearance.needsReload
                ) {
                    void appearance.save(photo).then((saved) => {
                        if (saved) onClose()
                    })
                }
            }}>
                <div
                    className="appearance-preview"
                    aria-label="Hintergrundvorschau"
                >
                    <BackgroundPhoto
                        imageId={appearance.imageId}
                        preview={photo}
                    />
                </div>

                <input
                    ref={input}
                    id={inputId}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="App-Hintergrund auswählen"
                    disabled={busy || !appearance.hasLoaded}
                    onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''

                        if (file) void select(file)
                    }}
                />

                <button
                    type="button"
                    disabled={busy || !appearance.hasLoaded}
                    onClick={() => input.current?.click()}
                >
                    {preparing
                        ? 'Foto vorbereiten …'
                        : hasPhoto
                            ? 'Hintergrund ändern'
                            : 'Hintergrund wählen'}
                </button>

                {hasPhoto && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            setPhoto(null)
                            setError('')
                        }}
                    >
                        Hintergrund entfernen
                    </button>
                )}

                {appearance.isLoading && (
                    <p role="status">
                        Hintergrund wird geladen …
                    </p>
                )}

                {(error || appearance.error) && (
                    <p role="alert">
                        {error || appearance.error}
                    </p>
                )}

                {appearance.needsReload &&
                    !appearance.isLoading && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={appearance.reload}
                        >
                            Aktuellen Stand laden
                        </button>
                    )}

                <button
                    type="submit"
                    disabled={
                        busy ||
                        photo === undefined ||
                        appearance.needsReload
                    }
                >
                    {appearance.isSaving
                        ? 'Speichern …'
                        : 'Speichern'}
                </button>
            </form>
        </Modal>
    )
}

export function AppAppearance({
                                  open,
                                  onClose,
                                  repository,
                                  imageStore,
                              }: {
    open: boolean
    onClose: () => void
    repository: AppearanceRepository
    imageStore: ProfileImageStore
}) {
    const appearance = useAppAppearance(repository, imageStore)

    return (
        <>
            {appearance.imageId && createPortal(
                <div
                    className="app-wallpaper"
                    aria-hidden="true"
                >
                    <BackgroundPhoto
                        imageId={appearance.imageId}
                    />
                </div>,
                document.body,
            )}

            {open && (
                <AppearanceEditor
                    appearance={appearance}
                    onClose={onClose}
                />
            )}
        </>
    )
}