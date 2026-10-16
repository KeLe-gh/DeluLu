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
    catalogItems: readonly {
        id: ItemId
        name: string
    }[]
    getItemName: (itemId: ItemId) => string
    onAddEntry: (
        name: string,
        position: number,
    ) => Promise<boolean>
    onAddExistingEntry: (
        itemId: ItemId,
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
                                      catalogItems,
                                      getItemName,
                                      onAddEntry,
                                      onAddExistingEntry,
                                      onUpdateEntry,
                                      onRemoveEntry,
                                      onReorderEntry,
                                      onBack,
                                  }: RankingDetailPageProps) {
    const [mode, setMode] = useState<'new' | 'existing'>('new')
    const [name, setName] = useState('')
    const [selectedItemId, setSelectedItemId] =
        useState<ItemId>('')
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

    const usedItemIds = new Set(
        list.entries.map((entry) => entry.itemId),
    )

    const availableProfiles = catalogItems
        .filter((item) => !usedItemIds.has(item.id))
        .sort((first, second) =>
            first.name.localeCompare(second.name, 'de-CH'),
        )

    async function addEntry() {
        if (isAdding) {
            return
        }

        const position = positionInput.trim() === ''
            ? nextPosition
            : Number(positionInput)

        if (!Number.isSafeInteger(position) || position < 1) {
            setError('Bitte gib eine gültige Position ab 1 ein.')
            return
        }

        if (mode === 'new' && name.trim() === '') {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (
            mode === 'existing' &&
            !availableProfiles.some(
                (item) => item.id === selectedItemId,
            )
        ) {
            setError('Bitte wähle ein vorhandenes Profil.')
            return
        }

        setIsAdding(true)
        setError('')

        try {
            const added = mode === 'new'
                ? await onAddEntry(name, position)
                : await onAddExistingEntry(
                    selectedItemId,
                    position,
                )

            if (!added) {
                setError(
                    'Der Eintrag konnte nicht hinzugefügt werden.',
                )
                return
            }

            setName('')
            setSelectedItemId('')
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
                        <label htmlFor="profile-source">
                            Profil
                        </label>

                        <select
                            id="profile-source"
                            value={mode}
                            onChange={(event) => {
                                setMode(
                                    event.target.value === 'existing'
                                        ? 'existing'
                                        : 'new',
                                )
                                setError('')
                            }}
                            disabled={isAdding}
                        >
                            <option value="new">
                                Neues Profil erstellen
                            </option>
                            <option value="existing">
                                Vorhandenes Profil auswählen
                            </option>
                        </select>
                    </div>

                    {mode === 'new' ? (
                        <div>
                            <label htmlFor="entry-name">
                                Name
                            </label>

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
                    ) : (
                        <div>
                            <label htmlFor="existing-profile">
                                Vorhandenes Profil
                            </label>

                            <select
                                id="existing-profile"
                                value={selectedItemId}
                                onChange={(event) =>
                                    setSelectedItemId(
                                        event.target.value,
                                    )
                                }
                                disabled={
                                    isAdding ||
                                    availableProfiles.length === 0
                                }
                                required
                            >
                                <option value="">
                                    Bitte auswählen
                                </option>

                                {availableProfiles.map((item) => (
                                    <option
                                        key={item.id}
                                        value={item.id}
                                    >
                                        {item.name}
                                    </option>
                                ))}
                            </select>

                            {availableProfiles.length === 0 && (
                                <p>
                                    Keine weiteren Profile verfügbar.
                                </p>
                            )}
                        </div>
                    )}

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

                    <button
                        type="submit"
                        disabled={
                            isAdding ||
                            (
                                mode === 'existing' &&
                                availableProfiles.length === 0
                            )
                        }
                    >
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