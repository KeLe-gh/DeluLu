import { useState } from 'react'
import { HomePage } from './app/HomePage'
import { useRankingWorkspace } from './app/hooks/useRankingWorkspace'
import { AuthGate } from './features/auth'
import { ListMenuPage } from './features/lists'
import { RankingsPage } from './features/rankings'
import { supabaseAuthService } from './infrastructure/supabase/supabaseAuthService'
import { supabaseCatalogRepository } from './infrastructure/supabase/supabaseCatalogRepository'
import { supabaseRankingRepository } from './infrastructure/supabase/supabaseRankingRepository'
import { supabaseRankingEditorRepository } from './infrastructure/supabase/supabaseRankingEditorRepository'
import './App.css'

type Screen = 'home' | 'lists' | 'rankings'

function DeluluApp() {
  const [screen, setScreen] = useState<Screen>('home')

  const workspace = useRankingWorkspace({
    catalogRepository: supabaseCatalogRepository,
    rankingRepository: supabaseRankingRepository,
    editorRepository: supabaseRankingEditorRepository,
  })

  const busy = workspace.isLoading || workspace.isSaving
  const blocked = busy || workspace.needsReload

  return (
      <>
        <section aria-label="Datenstatus">
          {workspace.isLoading && (
              <p role="status">Daten werden geladen …</p>
          )}

          {workspace.isSaving && (
              <p role="status">
                Änderungen werden gespeichert …
              </p>
          )}

          {workspace.error && (
              <p role="alert">{workspace.error}</p>
          )}

          {workspace.needsReload && (
              <button
                  type="button"
                  onClick={workspace.reload}
                  disabled={busy}
              >
                Daten erneut laden
              </button>
          )}
        </section>

        {workspace.hasLoaded && (
            <div inert={blocked} aria-busy={busy}>
              {screen === 'home' ? (
                  <HomePage
                      onOpenLists={() => setScreen('lists')}
                  />
              ) : (
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
                            lists={workspace.lists}
                            getItemName={workspace.getItemName}
                            onCreateList={workspace.createList}
                            onAddEntry={workspace.addEntry}
                            onUpdateEntry={workspace.updateEntry}
                            onRemoveEntry={workspace.removeEntry}
                            onReorderEntry={workspace.reorderEntry}
                        />
                    )}
                  </>
              )}
            </div>
        )}
      </>
  )
}

function App() {
  return (
      <AuthGate authService={supabaseAuthService}>
        <DeluluApp />
      </AuthGate>
  )
}

export default App