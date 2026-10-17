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
import { supabaseAppearanceRepository } from './infrastructure/supabase/supabaseAppearanceRepository'
import { supabaseAuthService } from './infrastructure/supabase/supabaseAuthService'
import { supabaseCatalogRepository } from './infrastructure/supabase/supabaseCatalogRepository'
import { supabaseProfileImageStore } from './infrastructure/supabase/supabaseProfileImageStore'
import { supabaseRankingRepository } from './infrastructure/supabase/supabaseRankingRepository'
import { supabaseRankingEditorRepository } from './infrastructure/supabase/supabaseRankingEditorRepository'
import { supabaseTierRepository } from './infrastructure/supabase/supabaseTierRepository'
import { ModalFeedbackContext } from './shared/components/ModalFeedbackContext'
import './App.css'

const CatalogWorkspace = lazy(
    () => import('./features/catalog/CatalogWorkspace'),
)

const TierWorkspace = lazy(
    () => import('./features/tiers/TierWorkspace'),
)

const SharedRankingsWorkspace = lazy(
    () => import('./features/sharing/SharedRankingsWorkspace'),
)

const LiveRankingDetail = lazy(
    () => import('./features/sharing/SharedRankingDetail'),
)

const MediaWorkspace = lazy(
    () => import('./features/media/MediaWorkspace'),
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

    const parent = path === '/'
        ? null
        : path === '/lists'
            ? '/'
            : '/lists'

    const canCreate = path === '/rankings'

    return (
        <>
            <AppHeader
                onHome={() => navigate('/')}
                onBack={parent ? () => back(parent) : undefined}
                onAdd={canCreate ? () => setCreateOpen(true) : undefined}
                addLabel="Liste erstellen"
            />

            {path === '/' ? (
                <HomePage
                    onOpenLists={() => navigate('/lists')}
                    onOpenCatalog={() => navigate('/catalog')}
                />
            ) : path === '/lists' ? (
                <ListMenuPage
                    onOpenRankings={() => navigate('/rankings')}
                    onOpenTiers={() => navigate('/tiers')}
                    onOpenShared={() => navigate('/shared')}
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

    const rankingId = navigation.path.match(
        /^\/rankings\/([0-9a-f-]{36})$/,
    )?.[1]

    if (rankingId) {
        return (
            <div className="app-shell">
                <Suspense
                    fallback={
                        <main className="page">
                            <p role="status">Liste wird geladen …</p>
                        </main>
                    }
                >
                    <LiveRankingDetail
                        key={rankingId}
                        id={rankingId}
                        owned
                        navigate={navigation.navigate}
                        onBack={() => navigation.back('/rankings')}
                    />
                </Suspense>
            </div>
        )
    }

    if (
        navigation.path === '/shared' ||
        navigation.path.startsWith('/shared/') ||
        navigation.path === '/share' ||
        navigation.path.startsWith('/share/') ||
        navigation.path === '/tier-share' ||
        navigation.path.startsWith('/tier-share/') ||
        navigation.path === '/shared-tiers' ||
        navigation.path.startsWith('/shared-tiers/')
    ) {
        return (
            <Suspense
                fallback={
                    <main className="page">
                        <p role="status">Liste wird geladen …</p>
                    </main>
                }
            >
                <SharedRankingsWorkspace
                    path={navigation.path}
                    onNavigate={navigation.navigate}
                    onBack={navigation.back}
                />
            </Suspense>
        )
    }

    if (
        navigation.path === '/media' ||
        navigation.path.startsWith('/media/')
    ) {
        return (
            <Suspense
                fallback={
                    <main className="page">
                        <p role="status">
                            Serien und Filme werden geladen …
                        </p>
                    </main>
                }
            >
                <MediaWorkspace />
            </Suspense>
        )
    }

    if (navigation.path === '/catalog') {
        return (
            <Suspense
                fallback={
                    <main className="page">
                        <p role="status">Katalog wird geladen …</p>
                    </main>
                }
            >
                <CatalogWorkspace
                    repository={supabaseCatalogRepository}
                    imageStore={supabaseProfileImageStore}
                    onNavigate={navigation.navigate}
                    onBack={navigation.back}
                />
            </Suspense>
        )
    }

    if (
        navigation.path === '/tiers' ||
        navigation.path.startsWith('/tiers/')
    ) {
        return (
            <Suspense
                fallback={
                    <main className="page">
                        <p role="status">Tierlisten werden geladen …</p>
                    </main>
                }
            >
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
                <ProfileImageContext.Provider
                    value={supabaseProfileImageStore}
                >
                    <AppAppearance
                        repository={supabaseAppearanceRepository}
                        imageStore={supabaseProfileImageStore}
                    />
                </ProfileImageContext.Provider>
            }
        >
            <ProfileImageContext.Provider
                value={supabaseProfileImageStore}
            >
                <DeluluApp />
            </ProfileImageContext.Provider>
        </AuthGate>
    )
}

export default App