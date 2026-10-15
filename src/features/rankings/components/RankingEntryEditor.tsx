import { useState } from 'react'

interface RankingEntryEditorProps {
    name: string
    position: number
    onSave: (name: string, position: number) => boolean
    onCancel: () => void
}

export function RankingEntryEditor({
                                       name,
                                       position,
                                       onSave,
                                       onCancel,
                                   }: RankingEntryEditorProps) {
    const [editedName, setEditedName] = useState(name)
    const [positionInput, setPositionInput] =
        useState(String(position))
    const [error, setError] = useState('')

    function save() {
        const newPosition = Number(positionInput)

        if (editedName.trim() === '') {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (
            !Number.isSafeInteger(newPosition) ||
            newPosition < 1
        ) {
            setError(
                'Bitte gib eine gültige Position ab 1 ein.',
            )
            return
        }

        const saved = onSave(editedName, newPosition)

        if (!saved) {
            setError(
                'Die Änderungen konnten nicht gespeichert werden.',
            )
        }
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault()
                save()
            }}
        >
            <h2>Eintrag bearbeiten</h2>

            <div>
                <label htmlFor="edit-entry-name">Name</label>

                <input
                    id="edit-entry-name"
                    type="text"
                    value={editedName}
                    onChange={(event) =>
                        setEditedName(event.target.value)
                    }
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
                    value={positionInput}
                    onChange={(event) =>
                        setPositionInput(event.target.value)
                    }
                    required
                />
            </div>

            {error && <p role="alert">{error}</p>}

            <button type="submit">
                Änderungen speichern
            </button>

            <button type="button" onClick={onCancel}>
                Abbrechen
            </button>
        </form>
    )
}