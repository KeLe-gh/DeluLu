import { useRef, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'

interface RankingEntryEditorProps {
    name: string
    position: number
    onSave: (
        name: string,
        position: number,
    ) => Promise<boolean>
    onRemove: () => Promise<boolean>
    onCancel: () => void
}

export function RankingEntryEditor({
                                       name,
                                       position,
                                       onSave,
                                       onRemove,
                                       onCancel,
                                   }: RankingEntryEditorProps) {
    const [editedName, setEditedName] = useState(name)
    const [editedPosition, setEditedPosition] =
        useState(String(position))
    const [error, setError] = useState('')
    const [pending, setPending] = useState(false)
    const pendingRef = useRef(false)

    async function perform(
        action: () => Promise<boolean>,
        failureMessage: string,
    ) {
        if (pendingRef.current) {
            return
        }

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

        if (editedName.trim() === '') {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (!Number.isSafeInteger(newPosition) || newPosition < 1) {
            setError('Bitte gib eine gültige Position ab 1 ein.')
            return
        }

        await perform(
            () => onSave(editedName, newPosition),
            'Die Änderungen konnten nicht gespeichert werden.',
        )
    }

    return (
        <Modal
            title="Eintrag bearbeiten"
            busy={pending}
            onClose={onCancel}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    void save()
                }}
            >
                <div>
                    <label htmlFor="edit-entry-name">Name</label>

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

                <p>
                    Eine Namensänderung gilt für dieses Profil
                    in allen Listen, die es verwenden.
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
                    Gespeicherter Stand: {name}, Position {position}.
                </p>

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={pending}>
                    {pending ? 'Bitte warten …' : 'Speichern'}
                </button>

                <button
                    type="button"
                    className="modal__danger"
                    onClick={() => {
                        void perform(
                            onRemove,
                            'Der Eintrag konnte nicht entfernt werden.',
                        )
                    }}
                    disabled={pending}
                >
                    Aus Liste entfernen
                </button>
            </form>
        </Modal>
    )
}