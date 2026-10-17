import { useId, useRef, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { PhotoPicker } from '../../images/components/PhotoPicker'
import type { PhotoChange } from '../../images/model/profileImageStore'
import type { CatalogItem } from '../model/catalog.types'
import type { CatalogProfileDraft } from '../model/catalogManager.repository'

export function CatalogProfileDialog({
                                         item,
                                         onSave,
                                         onRemove,
                                         onClose,
                                     }: {
    item?: CatalogItem
    onSave: (draft: CatalogProfileDraft) => Promise<boolean>
    onRemove: () => Promise<boolean>
    onClose: () => void
}) {
    const nameId = useId()
    const [id] = useState(() => item?.id ?? crypto.randomUUID())
    const [name, setName] = useState(item?.name ?? '')
    const [photo, setPhoto] = useState<PhotoChange>(undefined)
    const [background, setBackground] = useState<PhotoChange>(undefined)
    const [preparingPhoto, setPreparingPhoto] = useState(false)
    const [preparingBackground, setPreparingBackground] = useState(false)
    const [pending, setPending] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [error, setError] = useState('')
    const pendingRef = useRef(false)

    const preparing = preparingPhoto || preparingBackground

    async function perform(action: () => Promise<boolean>) {
        if (pendingRef.current || preparing) return

        pendingRef.current = true
        setPending(true)
        setError('')

        try {
            if (await action()) onClose()
        } catch {
            setError(
                confirming
                    ? 'Das Profil konnte nicht gelöscht werden. Bitte versuche es erneut.'
                    : 'Das Profil konnte nicht gespeichert werden. Bitte versuche es erneut.',
            )
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    function save() {
        if (!name.trim()) {
            setError('Bitte gib einen Namen ein.')
            return
        }

        void perform(() => onSave({
            id,
            name: name.trim(),
            photo,
            background,
        }))
    }

    return (
        <Modal
            title={
                confirming
                    ? 'Profil löschen?'
                    : item
                        ? 'Profil bearbeiten'
                        : 'Neues Profil'
            }
            busy={pending || preparing}
            onClose={onClose}
        >
            {confirming ? (
                <div className="catalog-confirm">
                    <p>
                        „{item?.name}“ wird endgültig aus dem
                        Katalog und allen Listen entfernt.
                    </p>

                    <button
                        type="button"
                        className="modal__danger"
                        onClick={() => {
                            void perform(onRemove)
                        }}
                    >
                        Endgültig löschen
                    </button>

                    <button
                        type="button"
                        onClick={() => setConfirming(false)}
                    >
                        Zurück
                    </button>
                </div>
            ) : (
                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        save()
                    }}
                >
                    <div>
                        <label htmlFor={nameId}>Name</label>

                        <input
                            id={nameId}
                            autoFocus
                            autoComplete="off"
                            maxLength={120}
                            required
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                        />
                    </div>

                    <PhotoPicker
                        imageId={item?.profileImageId ?? null}
                        value={photo}
                        name={name}
                        onChange={setPhoto}
                        onBusyChange={setPreparingPhoto}
                    />

                    <PhotoPicker
                        kind="background"
                        imageId={item?.backgroundImageId ?? null}
                        value={background}
                        name={name}
                        onChange={setBackground}
                        onBusyChange={setPreparingBackground}
                    />

                    <p className="field-hint">
                        Änderungen gelten in allen Listen.
                    </p>

                    <button
                        type="submit"
                        disabled={preparing}
                    >
                        {pending ? 'Speichern …' : 'Speichern'}
                    </button>

                    {item && (
                        <button
                            type="button"
                            className="modal__danger"
                            disabled={preparing}
                            onClick={() => {
                                setConfirming(true)
                                setError('')
                            }}
                        >
                            Profil löschen
                        </button>
                    )}
                </form>
            )}

            {error && <p role="alert">{error}</p>}
        </Modal>
    )
}