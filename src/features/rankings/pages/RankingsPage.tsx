import { useState } from 'react'
import type {
    EntryId,
    ItemId,
    ListId,
    RankingList,
} from '../../../shared/types/list.types'
import { getRankingSize } from '../model/ranking.operations'
import { RankingDetailPage } from './RankingDetailPage'

interface RankingsPageProps {
    lists: readonly RankingList[]
    getItemName: (itemId: ItemId) => string
    onCreateList: (title: string) => Promise<boolean>
    onAddEntry: (
        listId: ListId,
        name: string,
        position: number,
    ) => Promise<boolean>
    onUpdateEntry: (
        listId: ListId,
        entryId: EntryId,
        name: string,
        position: number,
    ) => Promise<boolean>
    onRemoveEntry: (
        listId: ListId,
        entryId: EntryId,
    ) => Promise<boolean>
    onReorderEntry: (
        listId: ListId,
        entryId: EntryId,
        toIndex: number,
    ) => Promise<boolean>
}

function getListLabel(list: RankingList): string {
    const size = getRankingSize(list)
    return size === 0 ? 'Leere Rangliste' : `Top ${size}`
}

export function RankingsPage({
                                 lists,
                                 getItemName,
                                 onCreateList,
                                 onAddEntry,
                                 onUpdateEntry,
                                 onRemoveEntry,
                                 onReorderEntry,
                             }: RankingsPageProps) {
    const [listName, setListName] = useState('')
    const [error, setError] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [selectedListId, setSelectedListId] =
        useState<ListId | null>(null)

    const selectedList = lists.find(
        (list) => list.id === selectedListId,
    )

    async function createList() {
        if (isCreating) {
            return
        }

        const title = listName.trim()

        if (title === '') {
            setError('Bitte gib einen Namen für deine Liste ein.')
            return
        }

        setIsCreating(true)
        setError('')

        try {
            const created = await onCreateList(title)

            if (!created) {
                setError('Die Liste konnte nicht erstellt werden.')
                return
            }

            setListName('')
        } catch {
            setError('Die Liste konnte nicht erstellt werden.')
        } finally {
            setIsCreating(false)
        }
    }

    if (selectedList) {
        return (
            <RankingDetailPage
                key={selectedList.id}
                list={selectedList}
                getItemName={getItemName}
                onAddEntry={(name, position) =>
                    onAddEntry(selectedList.id, name, position)
                }
                onUpdateEntry={(entryId, name, position) =>
                    onUpdateEntry(
                        selectedList.id,
                        entryId,
                        name,
                        position,
                    )
                }
                onRemoveEntry={(entryId) =>
                    onRemoveEntry(selectedList.id, entryId)
                }
                onReorderEntry={(entryId, toIndex) =>
                    onReorderEntry(
                        selectedList.id,
                        entryId,
                        toIndex,
                    )
                }
                onBack={() => setSelectedListId(null)}
            />
        )
    }

    return (
        <main>
            <h1>Meine Top-Listen</h1>

            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    void createList()
                }}
            >
                <div>
                    <label htmlFor="list-name">Listenname</label>

                    <input
                        id="list-name"
                        type="text"
                        placeholder="Name deiner Liste"
                        value={listName}
                        onChange={(event) =>
                            setListName(event.target.value)
                        }
                        disabled={isCreating}
                        required
                    />
                </div>

                <button type="submit" disabled={isCreating}>
                    {isCreating
                        ? 'Liste wird erstellt …'
                        : 'Liste erstellen'}
                </button>

                {error && <p role="alert">{error}</p>}
            </form>

            {lists.length === 0 && (
                <p>Du hast noch keine Top-Listen erstellt.</p>
            )}

            {lists.map((list) => (
                <article key={list.id}>
                    <button
                        type="button"
                        className="ranking-card"
                        onClick={() => setSelectedListId(list.id)}
                    >
                        <span className="ranking-card__title">
                            {list.title}
                        </span>
                        <span>{getListLabel(list)}</span>
                    </button>
                </article>
            ))}
        </main>
    )
}