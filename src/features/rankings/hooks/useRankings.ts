import { useState } from 'react'
import {
    addRankingEntry,
    createRankingList,
    moveRankingEntry,
} from '../model/ranking.operations'
import type {
    EntryId,
    ItemId,
    ListId,
    RankingList,
} from '../../../shared/types/list.types'

export function useRankings() {
    const [lists, setLists] = useState<RankingList[]>([])

    function addRankingList(title: string): boolean {
        const newList = createRankingList({
            id: crypto.randomUUID(),
            title,
            timestamp: new Date().toISOString(),
        })

        if (newList === null) {
            return false
        }

        setLists((currentLists) => [...currentLists, newList])
        return true
    }

    function addEntryToRanking(
        listId: ListId,
        itemId: ItemId,
        position: number,
    ): boolean {
        const list = lists.find(
            (currentList) => currentList.id === listId,
        )

        if (!list) {
            return false
        }

        const updatedList = addRankingEntry(list, {
            id: crypto.randomUUID(),
            itemId,
            position,
            timestamp: new Date().toISOString(),
        })

        if (updatedList === null) {
            return false
        }

        replaceList(updatedList)
        return true
    }

    function moveEntryInRanking(
        listId: ListId,
        entryId: EntryId,
        position: number,
    ): boolean {
        const list = lists.find(
            (currentList) => currentList.id === listId,
        )

        if (!list) {
            return false
        }

        const updatedList = moveRankingEntry(list, {
            entryId,
            position,
            timestamp: new Date().toISOString(),
        })

        if (updatedList === null) {
            return false
        }

        replaceList(updatedList)
        return true
    }

    function replaceList(updatedList: RankingList): void {
        setLists((currentLists) =>
            currentLists.map((currentList) =>
                currentList.id === updatedList.id
                    ? updatedList
                    : currentList,
            ),
        )
    }

    return {
        lists,
        addRankingList,
        addEntryToRanking,
        moveEntryInRanking,
    }
}