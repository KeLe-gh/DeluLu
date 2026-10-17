import { useState } from 'react'
import type {
    EntryId,
    ItemId,
    RankingList,
} from '../../../shared/types/list.types'
import { CreateRankingEntryDialog } from '../components/CreateRankingEntryDialog'
import { RankingEntryEditor } from '../components/RankingEntryEditor'
import { SortableRankingEntries } from '../components/SortableRankingEntries'
import { getRankingSize } from '../model/ranking.operations'
import { RankingShareButton } from '../components/RankingShareButton'

interface RankingDetailPageProps {
    list: RankingList
    catalogItems: readonly {
        id: ItemId
        name: string
        profileImageId: string | null
        backgroundImageId: string | null
    }[]
    createOpen: boolean
    onCloseCreate: () => void
    getItemName: (itemId: ItemId) => string
    getItemImageId: (itemId: ItemId) => string | null
    onAddEntry: (
        name: string,
        position: number,
        photo?: Blob | null,
        background?: Blob | null,
    ) => Promise<boolean>
    onAddExistingEntry: (
        itemId: ItemId,
        position: number,
    ) => Promise<boolean>
    onUpdateEntry: (
        entryId: EntryId,
        name: string,
        position: number,
        photo?: Blob | null,
        background?: Blob | null,
    ) => Promise<boolean>
    onRemoveEntry: (
        entryId: EntryId,
    ) => Promise<boolean>
    onReorderEntry: (
        entryId: EntryId,
        toIndex: number,
    ) => Promise<boolean>
}

export function RankingDetailPage({
                                      list,
                                      catalogItems,
                                      createOpen,
                                      onCloseCreate,
                                      getItemName,
                                      getItemImageId,
                                      onAddEntry,
                                      onAddExistingEntry,
                                      onUpdateEntry,
                                      onRemoveEntry,
                                      onReorderEntry,
                                  }: RankingDetailPageProps) {
    const [editingEntryId, setEditingEntryId] =
        useState<EntryId | null>(null)

    const editingEntry = list.entries.find(
        (entry) => entry.id === editingEntryId,
    )

    const getItemBackgroundImageId = (itemId: ItemId) =>
        catalogItems.find(
            (item) => item.id === itemId,
        )?.backgroundImageId ?? null

    const size = getRankingSize(list)

    return (
        <main className="page">
            <div className="page-heading">
                <h1>{list.title}</h1>

                <span className="count">
                    {size === 0 ? 'Leer' : 'Top ' + size}
                </span>
            </div>

            <RankingShareButton
                key={list.id}
                listId={list.id}
            />

            {createOpen && (
                <CreateRankingEntryDialog
                    list={list}
                    catalogItems={catalogItems}
                    onAddEntry={onAddEntry}
                    onAddExistingEntry={onAddExistingEntry}
                    onClose={onCloseCreate}
                />
            )}

            {editingEntry && (
                <RankingEntryEditor
                    key={editingEntry.id}
                    name={getItemName(editingEntry.itemId)}
                    position={editingEntry.position}
                    imageId={
                        getItemImageId(editingEntry.itemId)
                    }
                    backgroundImageId={
                        getItemBackgroundImageId(
                            editingEntry.itemId,
                        )
                    }
                    onSave={async (
                        name,
                        position,
                        photo,
                        background,
                    ) => {
                        const saved = await onUpdateEntry(
                            editingEntry.id,
                            name,
                            position,
                            photo,
                            background,
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
            )}

            {list.entries.length === 0 ? (
                <div className="empty-state">
                    <p>Noch keine Einträge.</p>
                    <p>Füge deinen ersten über + hinzu.</p>
                </div>
            ) : (
                <SortableRankingEntries
                    entries={list.entries}
                    getItemName={getItemName}
                    getItemImageId={getItemImageId}
                    getItemBackgroundImageId={
                        getItemBackgroundImageId
                    }
                    onEdit={setEditingEntryId}
                    onRemove={onRemoveEntry}
                    onReorder={onReorderEntry}
                />
            )}
        </main>
    )
}