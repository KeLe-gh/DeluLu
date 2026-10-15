import { useState } from 'react'
import {
    addRankingEntry,
    createRankingList,
} from '../model/ranking.operations'
import type {
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

        setLists((currentLists) =>
            currentLists.map((currentList) =>
                currentList.id === listId
                    ? updatedList
                    : currentList,
            ),
        )

        return true
    }

    return {
        lists,
        addRankingList,
        addEntryToRanking,
    }
}