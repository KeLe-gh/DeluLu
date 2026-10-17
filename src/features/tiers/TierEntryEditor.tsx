import { useId, useRef, useState } from 'react'
import type { CatalogItem } from '../catalog'
import { Modal } from '../../shared/components/Modal'
import { PhotoPicker } from '../images/components/PhotoPicker'
import type { PhotoChange } from '../images/model/profileImageStore'

export function TierEntryEditor({
                                    item,
                                    canEditProfile = true,
                                    onSave,
                                    onRemove,
                                    onClose,
                                }: {
    item: CatalogItem
    canEditProfile?: boolean
    onSave: (
        name: string,
        photo: PhotoChange,
        background: PhotoChange,
    ) => Promise<boolean>
    onRemove: () => Promise<boolean>
    onClose: () => void
}) {
    const nameId = useId()
    const [name, setName] = useState(item.name)
    const [photo, setPhoto] = useState<PhotoChange>(undefined)
    const [background, setBackground] = useState<PhotoChange>(undefined)
    const [preparingPhoto, setPreparingPhoto] = useState(false)
    const [preparingBackground, setPreparingBackground] = useState(false)
    const [busy, setBusy] = useState(false)
    const [confirm, setConfirm] = useState(false)
    const [error, setError] = useState('')
    const working = useRef(false)
    const preparing = preparingPhoto || preparingBackground

    async function perform(action: () => Promise<boolean>) {
        if (working.current || preparing) return

        working.current = true
        setBusy(true)
        setError('')

        try {
            if (await action()) onClose()
        } catch {
            setError('Die Änderung konnte nicht gespeichert werden.')
        } finally {
            working.current = false
            setBusy(false)
        }
    }

    return (
        <Modal
            title={confirm ? 'Eintrag entfernen?' : 'Eintrag bearbeiten'}
            busy={busy || preparing}
            onClose={onClose}
        >
            {confirm ? (
                <div className="sharing-stack">
                    <p>
                        „{item.name}“ wird aus dieser Liste entfernt.
                        Das Profil bleibt im Katalog erhalten.
                    </p>
                    <button
                        type="button"
                        className="modal__danger"
                        onClick={() => void perform(onRemove)}
                    >
                        Aus Liste entfernen
                    </button>
                    <button type="button" onClick={() => setConfirm(false)}>
                        Zurück
                    </button>
                </div>
            ) : (
                <form onSubmit={(event) => {
                    event.preventDefault()

                    if (!canEditProfile) return

                    if (!name.trim()) {
                        setError('Bitte gib einen Namen ein.')
                        return
                    }

                    void perform(() =>
                        onSave(name.trim(), photo, background),
                    )
                }}>
                    <div>
                        <label htmlFor={nameId}>Name</label>
                        <input
                            id={nameId}
                            readOnly={!canEditProfile}
                            autoFocus={canEditProfile}
                            autoComplete="off"
                            maxLength={120}
                            required
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>

                    {canEditProfile ? <>
                        <PhotoPicker
                            imageId={item.profileImageId}
                            value={photo}
                            name={name}
                            onChange={setPhoto}
                            onBusyChange={setPreparingPhoto}
                        />
                        <PhotoPicker
                            kind="background"
                            imageId={item.backgroundImageId}
                            value={background}
                            name={name}
                            onChange={setBackground}
                            onBusyChange={setPreparingBackground}
                        />
                        <p className="field-hint">
                            Name und Bilder gelten in allen Listen
                            mit diesem Profil.
                        </p>
                        <button type="submit" disabled={preparing}>
                            Speichern
                        </button>
                    </> : (
                        <p className="field-hint">
                            Name und Bilder kann nur die Person ändern,
                            der dieses Profil gehört.
                        </p>
                    )}

                    <button
                        type="button"
                        className="modal__danger"
                        disabled={preparing}
                        onClick={() => setConfirm(true)}
                    >
                        Aus Liste entfernen …
                    </button>
                </form>
            )}

            {error && <p role="alert">{error}</p>}
        </Modal>
    )
}