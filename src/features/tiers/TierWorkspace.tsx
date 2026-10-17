import { useState } from 'react'
import type { CatalogRepository } from '../catalog'
import type { ProfileImageStore } from '../images/model/profileImageStore'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import { AddTierEntryDialog } from './AddTierEntryDialog'
import { TierEntryPool } from './TierEntryPool'
import { AppHeader } from '../../app/AppHeader'
import type { TierRepository } from './tier.repository'
import { useTierLists } from './useTierLists'
import { TierBoard } from './TierBoard'
import { CreateTierListDialog } from './CreateTierListDialog'
import './Tiers.css'

export default function TierWorkspace({
                                          repository,
                                          catalogRepository,
                                          imageStore,
                                          path,
                                          onNavigate,
                                          onBack,
                                      }: {
    repository: TierRepository
    catalogRepository: CatalogRepository
    imageStore: ProfileImageStore
    path: string
    onNavigate: (path: string) => void
    onBack: (path: string) => void
}) {
    const state = useTierLists(
        repository,
        catalogRepository,
        imageStore,
    )

    const [createOpen, setCreateOpen] = useState(false)
    const [addOpen, setAddOpen] = useState(false)

    const overview = path === '/tiers'
    const match = path.match(/^\/tiers\/([^/]+)$/)

    let id: string | null = null

    try {
        id = match ? decodeURIComponent(match[1]) : null
    } catch {
        // Unavailable route.
    }

    const list = state.lists.find((item) => item.id === id)
    const busy = state.isLoading || state.isSaving

    const feedback = state.needsReload && !state.isLoading ? (
        <section className="tier-load-error">
            <p role="alert">{state.error}</p>

            <button
                type="button"
                onClick={state.reload}
                disabled={busy}
            >
                Aktuellen Stand laden
            </button>
        </section>
    ) : null

    return (
        <ModalFeedbackContext.Provider value={{
            busy,
            blocked: busy || state.needsReload,
            content: feedback,
        }}>
            <div className="app-shell">
                <AppHeader
                    onHome={() => onNavigate('/')}
                    onBack={() =>
                        onBack(overview ? '/lists' : '/tiers')
                    }
                    onAdd={
                        state.hasLoaded &&
                        !busy &&
                        !state.needsReload &&
                        (overview || list)
                            ? () => overview
                                ? setCreateOpen(true)
                                : setAddOpen(true)
                            : undefined
                    }
                    addLabel={
                        overview
                            ? 'Tierliste erstellen'
                            : 'Eintrag hinzufügen'
                    }
                />

                <main className="page" aria-busy={busy}>
                    {feedback}

                    {state.isLoading && (
                        <p role="status">
                            Tierlisten werden geladen …
                        </p>
                    )}

                    {state.hasLoaded && (
                        overview ? (
                            <>
                                <div className="page-heading">
                                    <h1>Tierlisten</h1>
                                    <span className="count">
                                        {state.lists.length}
                                    </span>
                                </div>

                                {state.lists.length === 0 ? (
                                    <div className="empty-state">
                                        <p>Noch keine Tierlisten.</p>
                                        <p>Erstelle deine erste über +.</p>
                                    </div>
                                ) : (
                                    <nav
                                        className="feature-grid"
                                        aria-label="Tierlisten"
                                    >
                                        {state.lists.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className="feature-card"
                                                onClick={() => onNavigate(
                                                    '/tiers/' +
                                                    encodeURIComponent(item.id),
                                                )}
                                            >
                                                <span
                                                    className="feature-card__icon"
                                                    aria-hidden="true"
                                                >
                                                    ▤
                                                </span>

                                                <span>{item.title}</span>

                                                <span
                                                    className="feature-card__arrow"
                                                    aria-hidden="true"
                                                >
                                                    ›
                                                </span>
                                            </button>
                                        ))}
                                    </nav>
                                )}
                            </>
                        ) : list ? (
                            <>
                                <div className="page-heading">
                                    <h1>{list.title}</h1>
                                </div>

                                <TierBoard tiers={list.tiers} />

                                <section
                                    className="tier-unassigned"
                                    aria-label="Nicht zugeordnet"
                                >
                                    <h2>Nicht zugeordnet</h2>

                                    <TierEntryPool
                                        entries={list.entries}
                                        items={state.items}
                                    />
                                </section>
                            </>
                        ) : (
                            <>
                                <h1>Nicht gefunden</h1>
                                <p>
                                    Diese Tierliste ist nicht verfügbar.
                                </p>
                            </>
                        )
                    )}
                </main>

                {list && addOpen && (
                    <AddTierEntryDialog
                        key={list.id}
                        list={list}
                        items={state.items}
                        onAdd={(draft) =>
                            state.addEntry(list.id, draft)
                        }
                        onClose={() => setAddOpen(false)}
                    />
                )}

                {overview && createOpen && (
                    <CreateTierListDialog
                        onClose={() => setCreateOpen(false)}
                        onCreate={async (input) => {
                            const createdId = await state.create(input)

                            if (!createdId) return false

                            setCreateOpen(false)
                            onNavigate(
                                '/tiers/' +
                                encodeURIComponent(createdId),
                            )

                            return true
                        }}
                    />
                )}
            </div>
        </ModalFeedbackContext.Provider>
    )
}