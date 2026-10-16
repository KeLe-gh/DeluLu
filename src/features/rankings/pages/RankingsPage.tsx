import { useState } from 'react'
import type { ListId, RankingList } from '../../../shared/types/list.types'
import { NameDialog } from '../../../shared/components/NameDialog'
import { SortableRankingLists } from '../components/SortableRankingLists'

interface RankingsPageProps {
    lists: readonly RankingList[]
    createOpen: boolean
    onCloseCreate: () => void
    onOpenList: (listId: ListId) => void
    onCreateList: (title: string) => Promise<boolean>
    onRenameList: (listId: ListId, title: string) => Promise<boolean>
    onDeleteList: (listId: ListId) => Promise<boolean>
    onReorderList: (listId: ListId, toIndex: number) => Promise<boolean>
}

export function RankingsPage({
    lists,
    createOpen,
    onCloseCreate,
    onOpenList,
    onCreateList,
    onRenameList,
    onDeleteList,
    onReorderList,
}: RankingsPageProps) {
    const [managedListId, setManagedListId] = useState<ListId | null>(null)
    const managedList = lists.find((list) => list.id === managedListId)

    return (
        <main className="page">
            <div className="page-heading">
                <h1>Top-Listen</h1>
                <span className="count">{lists.length}</span>
            </div>

            {createOpen && (
                <NameDialog
                    title="Neue Top-Liste"
                    onSave={onCreateList}
                    onClose={onCloseCreate}
                />
            )}

            {managedList && (
                <NameDialog
                    key={managedList.id}
                    title="Liste umbenennen"
                    initialValue={managedList.title}
                    onSave={(title) => onRenameList(managedList.id, title)}
                    onClose={() => setManagedListId(null)}
                />
            )}

            {lists.length === 0 ? (
                <div className="empty-state">
                    <p>Noch keine Listen.</p>
                    <p>Erstelle deine erste über +.</p>
                </div>
            ) : (
                <SortableRankingLists
                    lists={lists}
                    onOpen={onOpenList}
                    onRename={setManagedListId}
                    onDelete={onDeleteList}
                    onReorder={onReorderList}
                />
            )}
        </main>
    )
}