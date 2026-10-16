import { useState } from 'react'
import type {
    EntryId,
    ItemId,
    RankingList,
} from '../../../shared/types/list.types'
import { RankingEntryEditor } from '../components/RankingEntryEditor'
import { SortableRankingEntries } from '../components/SortableRankingEntries'
import { getRankingSize } from '../model/ranking.operations'

interface RankingDetailPageProps {
    list: RankingList
    getItemName: (itemId: ItemId) => string
    onAddEntry: (
        name: string,
        position: number,
    ) => Promise<boolean>
    onUpdateEntry: (
        entryId: EntryId,
        name: string,
        position: number,
    ) => Promise<boolean>
    onRemoveEntry: (entryId: EntryId) => Promise<boolean>
    onReorderEntry: (
        entryId: EntryId,
        toIndex: number,
    ) => Promise<boolean>
    onBack: () => void
}

export function RankingDetailPage({
                                      list,
                                      getItemName,
                                      onAddEntry,
                                      onUpdateEntry,
                                      onRemoveEntry,
                                      onReorderEntry,
                                      onBack,
                                  }: RankingDetailPageProps) {
    const [name, setName] = useState('')
    const [positionInput, setPositionInput] = useState('')
    const [error, setError] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [editingEntryId, setEditingEntryId] =
        useState<EntryId | null>(null)

    const size = getRankingSize(list)
    const nextPosition = size + 1

    const editingEntry = list.entries.find(
        (entry) => entry.id === editingEntryId,
    )

    async function addEntry() {
        if (isAdding) {
            return
        }

        const position = positionInput.trim() === ''
            ? nextPosition
            : Number(positionInput)

        if (name.trim() === '') {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (!Number.isSafeInteger(position) || position < 1) {
            setError('Bitte gib eine gültige Position ab 1 ein.')
            return
        }

        setIsAdding(true)
        setError('')

        try {
            const added = await onAddEntry(name, position)

            if (!added) {
                setError(
                    'Der Eintrag konnte nicht hinzugefügt werden.',
                )
                return
            }

            setName('')
            setPositionInput('')
        } catch {
            setError(
                'Der Eintrag konnte nicht hinzugefügt werden.',
            )
        } finally {
            setIsAdding(false)
        }
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

            {editingEntry ? (
                <RankingEntryEditor
                    key={editingEntry.id}
                    name={getItemName(editingEntry.itemId)}
                    position={editingEntry.position}
                    onSave={async (newName, newPosition) => {
                        const saved = await onUpdateEntry(
                            editingEntry.id,
                            newName,
                            newPosition,
                        )

                        if (saved) {
                            setEditingEntryId(null)
                        }

                        return saved
                    }}
                    onRemove={async () => {
                        const removed = await onRemoveEntry(
                            editingEntry.id,
                        )

                        if (removed) {
                            setEditingEntryId(null)
                        }

                        return removed
                    }}
                    onCancel={() => setEditingEntryId(null)}
                />
            ) : (
                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        void addEntry()
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
                            disabled={isAdding}
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
                            disabled={isAdding}
                        />

                        <p id="entry-position-help">
                            Leer lassen: am Ende auf Position{' '}
                            {nextPosition} einfügen.
                        </p>
                    </div>

                    <button type="submit" disabled={isAdding}>
                        {isAdding
                            ? 'Eintrag wird gespeichert …'
                            : 'Eintrag hinzufügen'}
                    </button>

                    {error && <p role="alert">{error}</p>}
                </form>
            )}

            <h2>Einträge</h2>

            {list.entries.length === 0 ? (
                <p>Diese Rangliste hat noch keine Einträge.</p>
            ) : (
                <SortableRankingEntries
                    entries={list.entries}
                    getItemName={getItemName}
                    onEdit={setEditingEntryId}
                    onRemove={onRemoveEntry}
                    onReorder={onReorderEntry}
                />
            )}
        </main>
    )
}