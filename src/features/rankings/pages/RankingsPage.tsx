import { useState } from 'react'
import type {
    EntryId,
    ItemId,
    ListId,
    RankingList,
} from '../../../shared/types/list.types'
import { RankingListManager } from '../components/RankingListManager'
import { SortableRankingLists } from '../components/SortableRankingLists'
import { RankingDetailPage } from './RankingDetailPage'

interface RankingsPageProps {
    lists: readonly RankingList[]
    catalogItems: readonly {
        id: ItemId
        name: string
    }[]
    getItemName: (itemId: ItemId) => string
    onCreateList: (title: string) => Promise<boolean>
    onRenameList: (
        listId: ListId,
        title: string,
    ) => Promise<boolean>
    onDeleteList: (listId: ListId) => Promise<boolean>
    onReorderList: (
        listId: ListId,
        toIndex: number,
    ) => Promise<boolean>
    onAddEntry: (
        listId: ListId,
        name: string,
        position: number,
    ) => Promise<boolean>
    onAddExistingEntry: (
        listId: ListId,
        itemId: ItemId,
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

export function RankingsPage({
                                 lists,
                                 catalogItems,
                                 getItemName,
                                 onCreateList,
                                 onRenameList,
                                 onDeleteList,
                                 onReorderList,
                                 onAddEntry,
                                 onAddExistingEntry,
                                 onUpdateEntry,
                                 onRemoveEntry,
                                 onReorderEntry,
                             }: RankingsPageProps) {
    const [listName, setListName] = useState('')
    const [error, setError] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [selectedListId, setSelectedListId] =
        useState<ListId | null>(null)
    const [managedListId, setManagedListId] =
        useState<ListId | null>(null)

    const selectedList = lists.find(
        (list) => list.id === selectedListId,
    )

    const managedList = lists.find(
        (list) => list.id === managedListId,
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
                catalogItems={catalogItems}
                getItemName={getItemName}
                onAddEntry={(name, position) =>
                    onAddEntry(selectedList.id, name, position)
                }
                onAddExistingEntry={(itemId, position) =>
                    onAddExistingEntry(
                        selectedList.id,
                        itemId,
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

            {managedList && (
                <RankingListManager
                    key={managedList.id}
                    list={managedList}
                    onRename={async (title) => {
                        const saved = await onRenameList(
                            managedList.id,
                            title,
                        )

                        if (saved) {
                            setManagedListId(null)
                        }

                        return saved
                    }}
                    onCancel={() => setManagedListId(null)}
                />
            )}

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

            {lists.length === 0 ? (
                <p>Du hast noch keine Top-Listen erstellt.</p>
            ) : (
                <SortableRankingLists
                    lists={lists}
                    onOpen={setSelectedListId}
                    onRename={setManagedListId}
                    onDelete={onDeleteList}
                    onReorder={onReorderList}
                />
            )}
        </main>
    )
}