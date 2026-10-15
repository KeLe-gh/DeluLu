import { useState } from 'react'
import type { FormEvent } from 'react'

interface RankingEntryEditorProps {
    name: string
    position: number
    onSave: (name: string, position: number) => boolean
    onRemove: () => boolean
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
    const [error, setError] = useState('')

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)
        const newPosition = Number(formData.get('position'))

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

        if (!onSave(editedName, newPosition)) {
            setError(
                'Die Änderungen konnten nicht gespeichert werden.',
            )
        }
    }

    function remove() {
        if (!onRemove()) {
            setError(
                'Der Eintrag konnte nicht entfernt werden.',
            )
        }
    }

    return (
        <form onSubmit={save}>
            <h2>Eintrag bearbeiten</h2>

            <div>
                <label htmlFor="edit-entry-name">
                    Name
                </label>

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
                    key={position}
                    id="edit-entry-position"
                    name="position"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={position}
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

            <button type="button" onClick={remove}>
                Aus Liste entfernen
            </button>
        </form>
    )
}