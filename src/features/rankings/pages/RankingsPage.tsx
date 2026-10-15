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
    onCreateList: (title: string) => boolean
    onAddEntry: (
        listId: ListId,
        name: string,
        position: number,
    ) => boolean
    onUpdateEntry: (
        listId: ListId,
        entryId: EntryId,
        name: string,
        position: number,
    ) => boolean
    onRemoveEntry: (
        listId: ListId,
        entryId: EntryId,
    ) => boolean
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
                             }: RankingsPageProps) {
    const [listName, setListName] = useState('')
    const [error, setError] = useState('')
    const [selectedListId, setSelectedListId] =
        useState<ListId | null>(null)

    const selectedList = lists.find(
        (list) => list.id === selectedListId,
    )

    function createList() {
        const created = onCreateList(listName)

        if (!created) {
            setError('Bitte gib einen Namen für deine Liste ein.')
            return
        }

        setListName('')
        setError('')
    }

    if (selectedList) {
        return (
            <RankingDetailPage
                key={selectedList.id}
                list={selectedList}
                getItemName={getItemName}
                onAddEntry={(name, position) =>
                    onAddEntry(
                        selectedList.id,
                        name,
                        position,
                    )
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
                    createList()
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
                        required
                    />
                </div>

                <button type="submit">Liste erstellen</button>

                {error && <p role="alert">{error}</p>}
            </form>

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