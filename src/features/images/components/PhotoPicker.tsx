import { useEffect, useId, useRef, useState } from 'react'
import type { ImageId } from '../../../shared/types/list.types'
import type { PhotoChange } from '../model/profileImageStore'
import { prepareProfilePhoto } from '../model/prepareProfilePhoto'
import { ProfilePhoto } from './ProfilePhoto'

export function PhotoPicker({
    imageId,
    value,
    onChange,
    onBusyChange,
    name,
}: {
    imageId: ImageId | null
    value: PhotoChange
    onChange: (photo: PhotoChange) => void
    onBusyChange: (busy: boolean) => void
    name: string
}) {
    const inputId = useId()
    const request = useRef(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const hasPhoto = value instanceof Blob || (value === undefined && imageId !== null)

    useEffect(() => () => { request.current += 1 }, [])

    async function select(file: File) {
        const current = ++request.current
        setBusy(true)
        onBusyChange(true)
        setError('')
        try {
            const photo = await prepareProfilePhoto(file)
            if (current === request.current) onChange(photo)
        } catch (error) {
            if (current === request.current) {
                setError(error instanceof Error ? error.message : 'Das Foto konnte nicht geöffnet werden.')
            }
        } finally {
            if (current === request.current) {
                setBusy(false)
                onBusyChange(false)
            }
        }
    }

    return (
        <div className="photo-picker">
            <ProfilePhoto
                imageId={value === undefined ? imageId : null}
                preview={value}
                name={name}
            />
            <div className="photo-picker__actions">
                <input
                    ref={inputRef}
                    id={inputId}
                    className="sr-only photo-picker__input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Profilfoto auswählen"
                    disabled={busy}
                    onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void select(file)
                    }}
                />
                <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
                    {busy ? 'Foto vorbereiten …' : hasPhoto ? 'Foto ändern' : 'Foto wählen'}
                </button>
                {hasPhoto && (
                    <button type="button" onClick={() => { onChange(null); setError('') }} disabled={busy}>
                        Foto entfernen
                    </button>
                )}
            </div>
            {error && <p role="alert">{error}</p>}
        </div>
    )
}
