import { useState } from 'react'
import { HomePage } from './app/HomePage'
import { ListMenuPage } from './features/lists'
import { RankingsPage, useRankings } from './features/rankings'
import {
  createCatalogItem,
  renameCatalogItem,
  useCatalog,
} from './features/catalog'
import type {
  EntryId,
  ItemId,
  ListId,
} from './shared/types/list.types'
import './App.css'

type Screen = 'home' | 'lists' | 'rankings'

function App() {
  const [screen, setScreen] = useState<Screen>('home')

  const {
    lists,
    addRankingList,
    addEntryToRanking,
    moveEntryInRanking,
    removeEntryFromRanking,
  } = useRankings()

  const {
    items,
    addCatalogItem,
    updateCatalogItem,
  } = useCatalog()

  function getItemName(itemId: ItemId): string {
    return items.find((item) => item.id === itemId)?.name
        ?? 'Unbekannter Eintrag'
  }

  function addEntry(
      listId: ListId,
      name: string,
      position: number,
  ): boolean {
    const item = createCatalogItem({
      id: crypto.randomUUID(),
      name,
      timestamp: new Date().toISOString(),
    })

    if (item === null) {
      return false
    }

    const added = addEntryToRanking(
        listId,
        item.id,
        position,
    )

    if (!added) {
      return false
    }

    addCatalogItem(item)
    return true
  }

  function updateEntry(
      listId: ListId,
      entryId: EntryId,
      name: string,
      position: number,
  ): boolean {
    const list = lists.find(
        (currentList) => currentList.id === listId,
    )

    const entry = list?.entries.find(
        (currentEntry) => currentEntry.id === entryId,
    )

    if (!entry) {
      return false
    }

    const item = items.find(
        (currentItem) => currentItem.id === entry.itemId,
    )

    if (!item) {
      return false
    }

    const updatedItem = renameCatalogItem(item, {
      name,
      timestamp: new Date().toISOString(),
    })

    if (updatedItem === null) {
      return false
    }

    const moved = moveEntryInRanking(
        listId,
        entryId,
        position,
    )

    if (!moved) {
      return false
    }

    updateCatalogItem(updatedItem)
    return true
  }

  if (screen === 'home') {
    return (
        <HomePage
            onOpenLists={() => setScreen('lists')}
        />
    )
  }

  return (
      <>
        <nav aria-label="Seitennavigation">
          <button
              type="button"
              onClick={() =>
                  setScreen(
                      screen === 'rankings'
                          ? 'lists'
                          : 'home',
                  )
              }
          >
            {screen === 'rankings'
                ? 'Zur Listenübersicht'
                : 'Zur Startseite'}
          </button>
        </nav>

        {screen === 'lists' ? (
            <ListMenuPage
                onOpenRankings={() =>
                    setScreen('rankings')
                }
            />
        ) : (
            <RankingsPage
                lists={lists}
                getItemName={getItemName}
                onCreateList={addRankingList}
                onAddEntry={addEntry}
                onUpdateEntry={updateEntry}
                onRemoveEntry={removeEntryFromRanking}
            />
        )}
      </>
  )
}

export default App