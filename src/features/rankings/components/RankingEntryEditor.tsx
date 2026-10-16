import { useRef, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { PhotoPicker } from '../../images/components/PhotoPicker'
import type { PhotoChange } from '../../images/model/profileImageStore'

interface RankingEntryEditorProps {
    name: string
    position: number
    imageId: string | null
    backgroundImageId: string | null
    onSave: (
        name: string,
        position: number,
        photo: PhotoChange,
        background: PhotoChange,
    ) => Promise<boolean>
    onRemove: () => Promise<boolean>
    onCancel: () => void
}

export function RankingEntryEditor({
                                       name,
                                       position,
                                       imageId,
                                       backgroundImageId,
                                       onSave,
                                       onRemove,
                                       onCancel,
                                   }: RankingEntryEditorProps) {
    const [editedName, setEditedName] = useState(name)
    const [editedPosition, setEditedPosition] =
        useState(String(position))

    const [photo, setPhoto] =
        useState<PhotoChange>(undefined)

    const [preparingPhoto, setPreparingPhoto] =
        useState(false)

    const [background, setBackground] =
        useState<PhotoChange>(undefined)

    const [preparingBackground, setPreparingBackground] =
        useState(false)

    const preparing = preparingPhoto || preparingBackground

    const [error, setError] = useState('')
    const [pending, setPending] = useState(false)
    const pendingRef = useRef(false)

    async function perform(
        action: () => Promise<boolean>,
        failureMessage: string,
    ) {
        if (pendingRef.current || preparing) return

        pendingRef.current = true
        setPending(true)
        setError('')

        try {
            if (!await action()) {
                setError(failureMessage)
            }
        } catch {
            setError(failureMessage)
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    async function save() {
        const newPosition = Number(editedPosition)

        if (!editedName.trim()) {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (
            !Number.isSafeInteger(newPosition) ||
            newPosition < 1
        ) {
            setError('Bitte gib eine gültige Position ab 1 ein.')
            return
        }

        await perform(
            () => onSave(
                editedName,
                newPosition,
                photo,
                background,
            ),
            'Die Änderungen konnten nicht gespeichert werden.',
        )
    }

    return (
        <Modal
            title="Eintrag bearbeiten"
            busy={pending || preparing}
            onClose={onCancel}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    void save()
                }}
            >
                <div>
                    <label htmlFor="edit-entry-name">
                        Name
                    </label>

                    <input
                        id="edit-entry-name"
                        type="text"
                        autoFocus
                        value={editedName}
                        onChange={(event) =>
                            setEditedName(event.target.value)
                        }
                        disabled={pending}
                        required
                    />
                </div>

                <PhotoPicker
                    imageId={imageId}
                    value={photo}
                    onChange={setPhoto}
                    onBusyChange={setPreparingPhoto}
                    name={editedName}
                />

                <PhotoPicker
                    kind="background"
                    imageId={backgroundImageId}
                    value={background}
                    onChange={setBackground}
                    onBusyChange={setPreparingBackground}
                    name={editedName}
                />

                <p className="field-hint">
                    Name und Bilder gelten in allen Listen
                    mit diesem Profil.
                </p>

                <div>
                    <label htmlFor="edit-entry-position">
                        Position
                    </label>

                    <input
                        id="edit-entry-position"
                        type="number"
                        min="1"
                        step="1"
                        value={editedPosition}
                        onChange={(event) =>
                            setEditedPosition(event.target.value)
                        }
                        disabled={pending}
                        required
                    />
                </div>

                <p>
                    Gespeicherter Stand: {name},
                    Position {position}.
                </p>

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={pending}>
                    {pending ? 'Bitte warten …' : 'Speichern'}
                </button>

                <button
                    type="button"
                    className="modal__danger"
                    disabled={pending}
                    onClick={() => {
                        void perform(
                            onRemove,
                            'Der Eintrag konnte nicht entfernt werden.',
                        )
                    }}
                >
                    Aus Liste entfernen
                </button>
            </form>
        </Modal>
    )
}