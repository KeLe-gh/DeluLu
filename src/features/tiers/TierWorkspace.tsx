import { useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import type { TierRepository } from './tier.repository'
import { useTierLists } from './useTierLists'
import { TierBoard } from './TierBoard'
import { CreateTierListDialog } from './CreateTierListDialog'
import './Tiers.css'

export default function TierWorkspace({
                                          repository,
                                          path,
                                          onNavigate,
                                          onBack,
                                      }: {
    repository: TierRepository
    path: string
    onNavigate: (path: string) => void
    onBack: (path: string) => void
}) {
    const state = useTierLists(repository)
    const [createOpen, setCreateOpen] = useState(false)

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

    return (
        <div className="app-shell">
            <AppHeader
                onHome={() => onNavigate('/')}
                onBack={() =>
                    onBack(overview ? '/lists' : '/tiers')
                }
                onAdd={
                    overview && state.hasLoaded && !busy
                        ? () => setCreateOpen(true)
                        : undefined
                }
                addLabel="Tierliste erstellen"
            />

            <main className="page" aria-busy={busy}>
                {state.error && (
                    <section className="tier-load-error">
                        <p role="alert">{state.error}</p>

                        <button
                            type="button"
                            onClick={state.reload}
                            disabled={busy}
                        >
                            Erneut laden
                        </button>
                    </section>
                )}

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

                                <div className="tier-pool">
                                    <p>Noch keine Einträge.</p>
                                </div>
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
    )
}