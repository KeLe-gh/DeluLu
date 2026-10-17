import { lazy, Suspense, useState } from 'react'
import { AppHeader } from './app/AppHeader'
import { HomePage } from './app/HomePage'
import { useAppNavigation } from './app/hooks/useAppNavigation'
import { useRankingWorkspace } from './app/hooks/useRankingWorkspace'
import { AuthGate } from './features/auth'
import { AppAppearance } from './features/appearance/AppAppearance'
import { ProfileImageContext } from './features/images/ProfileImageContext'
import { ListMenuPage } from './features/lists'
import { RankingsPage } from './features/rankings'
import { RankingDetailPage } from './features/rankings/pages/RankingDetailPage'
import { supabaseAppearanceRepository } from './infrastructure/supabase/supabaseAppearanceRepository'
import { supabaseAuthService } from './infrastructure/supabase/supabaseAuthService'
import { supabaseCatalogRepository } from './infrastructure/supabase/supabaseCatalogRepository'
import { supabaseProfileImageStore } from './infrastructure/supabase/supabaseProfileImageStore'
import { supabaseRankingRepository } from './infrastructure/supabase/supabaseRankingRepository'
import { supabaseRankingEditorRepository } from './infrastructure/supabase/supabaseRankingEditorRepository'
import { supabaseTierRepository } from './infrastructure/supabase/supabaseTierRepository'
import { ModalFeedbackContext } from './shared/components/ModalFeedbackContext'
import './App.css'

const TierWorkspace = lazy(
    () => import('./features/tiers/TierWorkspace'),
)

type Workspace = ReturnType<typeof useRankingWorkspace>
type Navigation = ReturnType<typeof useAppNavigation>

function WorkspaceScreen({
                             workspace,
                             navigation,
                         }: {
    workspace: Workspace
    navigation: Navigation
}) {
    const [createOpen, setCreateOpen] = useState(false)
    const { path, navigate, back } = navigation
    const match = path.match(/^\/rankings\/([^/]+)$/)

    let listId: string | null = null

    try {
        listId = match ? decodeURIComponent(match[1]) : null
    } catch {
        listId = null
    }

    const list = workspace.lists.find(
        (item) => item.id === listId,
    )

    const parent = path === '/'
        ? null
        : path === '/lists'
            ? '/'
            : path === '/rankings'
                ? '/lists'
                : match
                    ? '/rankings'
                    : '/'

    const canCreate = path === '/rankings' || Boolean(list)

    return (
        <>
            <AppHeader
                onHome={() => navigate('/')}
                onBack={parent ? () => back(parent) : undefined}
                onAdd={canCreate ? () => setCreateOpen(true) : undefined}
                addLabel={list ? 'Eintrag hinzufügen' : 'Liste erstellen'}
            />

            {path === '/' ? (
                <HomePage
                    onOpenLists={() => navigate('/lists')}
                />
            ) : path === '/lists' ? (
                <ListMenuPage
                    onOpenRankings={() => navigate('/rankings')}
                    onOpenTiers={() => navigate('/tiers')}
                />
            ) : path === '/rankings' ? (
                <RankingsPage
                    lists={workspace.lists}
                    createOpen={createOpen}
                    onCloseCreate={() => setCreateOpen(false)}
                    onOpenList={(id) =>
                        navigate('/rankings/' + encodeURIComponent(id))
                    }
                    onCreateList={workspace.createList}
                    onRenameList={workspace.renameList}
                    onDeleteList={workspace.deleteList}
                    onReorderList={workspace.reorderList}
                />
            ) : list ? (
                <RankingDetailPage
                    list={list}
                    catalogItems={workspace.items}
                    createOpen={createOpen}
                    onCloseCreate={() => setCreateOpen(false)}
                    getItemName={workspace.getItemName}
                    getItemImageId={workspace.getItemImageId}
                    onAddEntry={(name, position, photo) =>
                        workspace.addEntry(
                            list.id,
                            name,
                            position,
                            photo,
                        )
                    }
                    onAddExistingEntry={(id, position) =>
                        workspace.addExistingEntry(
                            list.id,
                            id,
                            position,
                        )
                    }
                    onUpdateEntry={(id, name, position, photo, background) =>
                        workspace.updateEntry(
                            list.id,
                            id,
                            name,
                            position,
                            photo,
                            background,
                        )
                    }
                    onRemoveEntry={(id) =>
                        workspace.removeEntry(list.id, id)
                    }
                    onReorderEntry={(id, index) =>
                        workspace.reorderEntry(list.id, id, index)
                    }
                />
            ) : (
                <main className="page">
                    <h1>Nicht gefunden</h1>
                    <p className="field-hint">
                        Diese Seite oder Liste ist nicht verfügbar.
                    </p>
                </main>
            )}
        </>
    )
}

function RankingApp() {
    const navigation = useAppNavigation()

    const workspace = useRankingWorkspace({
        catalogRepository: supabaseCatalogRepository,
        rankingRepository: supabaseRankingRepository,
        editorRepository: supabaseRankingEditorRepository,
        imageStore: supabaseProfileImageStore,
    })

    const busy = workspace.isLoading || workspace.isSaving
    const blocked = busy || workspace.needsReload

    const hasFeedback =
        busy ||
        Boolean(workspace.error) ||
        workspace.needsReload

    const feedback = hasFeedback ? (
        <section className="app-feedback" aria-label="Datenstatus">
            {busy && (
                <p role="status">
                    {workspace.isLoading
                        ? 'Daten werden geladen …'
                        : 'Speichern …'}
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
    ) : null

    return (
        <ModalFeedbackContext.Provider
            value={{ busy, blocked, content: feedback }}
        >
            <div className="app-shell">
                {feedback}

                {workspace.hasLoaded && (
                    <div inert={blocked} aria-busy={busy}>
                        <WorkspaceScreen
                            key={navigation.path}
                            workspace={workspace}
                            navigation={navigation}
                        />
                    </div>
                )}
            </div>
        </ModalFeedbackContext.Provider>
    )
}

function DeluluApp() {
    const navigation = useAppNavigation()

    if (
        navigation.path === '/tiers' ||
        navigation.path.startsWith('/tiers/')
    ) {
        return (
            <Suspense fallback={
                          <main className="page">
                              <p role="status">
                                  Tierlisten werden geladen …
                              </p>
                          </main>
                      }>
                <TierWorkspace
                    repository={supabaseTierRepository}
                    catalogRepository={supabaseCatalogRepository}
                    imageStore={supabaseProfileImageStore}
                    path={navigation.path}
                    onNavigate={navigation.navigate}
                    onBack={navigation.back}
                />
            </Suspense>
        )
    }

    return <RankingApp />
}

function App() {
    const navigation = useAppNavigation()

    return (
        <AuthGate
            authService={supabaseAuthService}
            path={navigation.path}
            onNavigate={navigation.navigate}
            accountActions={
                <ProfileImageContext.Provider value={supabaseProfileImageStore}>
                    <AppAppearance
                        repository={supabaseAppearanceRepository}
                        imageStore={supabaseProfileImageStore}
                    />
                </ProfileImageContext.Provider>
            }
        >
            <ProfileImageContext.Provider value={supabaseProfileImageStore}>
                <DeluluApp />
            </ProfileImageContext.Provider>
        </AuthGate>
    )
}

export default App