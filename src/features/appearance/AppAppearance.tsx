import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BackgroundPhoto } from '../images/components/BackgroundPhoto'
import { BackgroundCropper } from '../images/components/BackgroundCropper'
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

    const [photo, setPhoto] = useState<PhotoChange>(undefined)
    const [cropFile, setCropFile] = useState<File | null>(null)

    const [aspectRatio] = useState(
        () => window.innerWidth / window.innerHeight,
    )

    const [error, setError] = useState('')

    const busy =
        Boolean(cropFile) ||
        appearance.isSaving ||
        appearance.isLoading

    const hasPhoto =
        photo instanceof Blob ||
        (photo === undefined && appearance.imageId !== null)

    function select(file: File) {
        setError('')

        if (
            file.size === 0 ||
            file.size > 30 * 1024 * 1024
        ) {
            setError('Bitte wähle ein Foto mit höchstens 30 MB.')
            return
        }

        if (
            file.type &&
            !file.type.startsWith('image/')
        ) {
            setError('Bitte wähle ein Foto.')
            return
        }

        setCropFile(file)
    }

    return createPortal(
        <>
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
                        style={{
                            aspectRatio,
                            width: `min(
                                100%,
                                ${40 * aspectRatio}svh,
                                ${20 * aspectRatio}rem
                            )`,
                            height: 'auto',
                        }}
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

                            if (file) select(file)
                        }}
                    />

                    <button
                        type="button"
                        disabled={busy || !appearance.hasLoaded}
                        onClick={() => input.current?.click()}
                    >
                        {hasPhoto
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

            {cropFile && (
                <BackgroundCropper
                    file={cropFile}
                    aspectRatio={aspectRatio}
                    onConfirm={(result) => {
                        setPhoto(result)
                        setCropFile(null)
                    }}
                    onCancel={() => setCropFile(null)}
                />
            )}
        </>,
        document.body,
    )
}

export function AppAppearance({
                                  repository,
                                  imageStore,
                              }: {
    repository: AppearanceRepository
    imageStore: ProfileImageStore
}) {
    const [open, setOpen] = useState(false)
    const appearance = useAppAppearance(repository, imageStore)

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
            >
                Aussehen
            </button>

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
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    )
}