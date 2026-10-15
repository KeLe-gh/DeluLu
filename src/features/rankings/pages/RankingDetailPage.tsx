import { useState } from 'react'
import type {
    ItemId,
    RankingList,
} from '../../../shared/types/list.types'
import { getRankingSize } from '../model/ranking.operations'

interface RankingDetailPageProps {
    list: RankingList
    getItemName: (itemId: ItemId) => string
    onAddEntry: (name: string, position: number) => boolean
    onBack: () => void
}

export function RankingDetailPage({
                                      list,
                                      getItemName,
                                      onAddEntry,
                                      onBack,
                                  }: RankingDetailPageProps) {
    const [name, setName] = useState('')
    const [positionInput, setPositionInput] = useState('')
    const [error, setError] = useState('')

    const size = getRankingSize(list)
    const nextPosition = size + 1

    const orderedEntries = [...list.entries].sort(
        (a, b) => a.position - b.position,
    )

    function addEntry() {
        const position =
            positionInput.trim() === ''
                ? nextPosition
                : Number(positionInput)

        if (name.trim() === '') {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (
            !Number.isSafeInteger(position) ||
            position < 1
        ) {
            setError(
                'Bitte gib eine gültige Position ab 1 ein.',
            )
            return
        }

        const added = onAddEntry(name, position)

        if (!added) {
            setError(
                'Der Eintrag konnte nicht hinzugefügt werden.',
            )
            return
        }

        setName('')
        setPositionInput('')
        setError('')
    }

    return (
        <main>
            <button type="button" onClick={onBack}>
                Zurück zu Top-Listen
            </button>

            <h1>{list.title}</h1>

            <p>
                {size === 0 ? 'Leere Rangliste' : `Top ${size}`}
            </p>

            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    addEntry()
                }}
            >
                <h2>Eintrag hinzufügen</h2>

                <div>
                    <label htmlFor="entry-name">Name</label>

                    <input
                        id="entry-name"
                        type="text"
                        value={name}
                        onChange={(event) =>
                            setName(event.target.value)
                        }
                        placeholder="Zum Beispiel Nanami"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="entry-position">
                        Position
                    </label>

                    <input
                        id="entry-position"
                        type="number"
                        min="1"
                        step="1"
                        value={positionInput}
                        onChange={(event) =>
                            setPositionInput(event.target.value)
                        }
                        placeholder={String(nextPosition)}
                        aria-describedby="entry-position-help"
                    />

                    <p id="entry-position-help">
                        Leer lassen: am Ende auf Position{' '}
                        {nextPosition} einfügen.
                    </p>
                </div>

                <button type="submit">
                    Eintrag hinzufügen
                </button>

                {error && <p role="alert">{error}</p>}
            </form>

            <h2>Einträge</h2>

            {orderedEntries.length === 0 ? (
                <p>Diese Rangliste hat noch keine Einträge.</p>
            ) : (
                <ol>
                    {orderedEntries.map((entry) => (
                        <li
                            key={entry.id}
                            value={entry.position}
                        >
                            {getItemName(entry.itemId)}
                        </li>
                    ))}
                </ol>
            )}
        </main>
    )
}