import { useState } from 'react'
import { HomePage } from './app/HomePage'
import { ListMenuPage } from './features/lists'
import { RankingsPage, useRankings } from './features/rankings'
import {
  createCatalogItem,
  useCatalog,
} from './features/catalog'
import type {
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
  } = useRankings()

  const {
    items,
    addCatalogItem,
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

  if (screen === 'home') {
    return (
        <HomePage onOpenLists={() => setScreen('lists')} />
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
            />
        )}
      </>
  )
}

export default App