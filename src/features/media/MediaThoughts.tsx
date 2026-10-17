import { useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import { supabaseMediaThoughtRepository } from '../../infrastructure/supabase/supabaseMediaThoughtRepository'
import { Modal } from '../../shared/components/Modal'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import type { MediaTitle } from './media.types'
import { mediaStatusLabels } from './media.types'
import type {
    MediaThought,
    MediaThoughtRepository,
} from './mediaThought.types'
import { useMediaThoughts } from './useMediaThoughts'
import { MediaThoughtDialog } from './MediaThoughtDialog'

export function MediaThoughts({
                                  title,
                                  onHome,
                                  onBack,
                                  repository = supabaseMediaThoughtRepository,
                              }: {
    title: MediaTitle
    onHome: () => void
    onBack: () => void
    repository?: MediaThoughtRepository
}) {
    const workspace = useMediaThoughts(title.id, repository)

    const [editor, setEditor] = useState<{
        thought?: MediaThought
    } | null>(null)

    const [deleting, setDeleting] =
        useState<MediaThought | null>(null)

    const busy = workspace.loading || workspace.saving
    const blocked = busy || workspace.needsReload

    const thoughts = [...workspace.thoughts].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id),
    )

    const feedback =
        busy || workspace.error || workspace.needsReload ? (
            <section
                className="app-feedback"
                aria-label="Datenstatus"
            >
                {busy && (
                    <p role="status">
                        {workspace.loading
                            ? 'Gedanken werden geladen …'
                            : 'Speichern …'}
                    </p>
                )}

                {workspace.error && (
                    <p role="alert">{workspace.error}</p>
                )}

                {workspace.needsReload && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={workspace.reload}
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
            {feedback}

            <div inert={blocked} aria-busy={busy}>
                <AppHeader
                    onHome={onHome}
                    onBack={onBack}
                    onAdd={() => setEditor({})}
                    addLabel="Gedanke hinzufügen"
                />

                <main className="page">
                    <div className="media-detail-heading">
                        <h1>{title.name}</h1>

                        <p>
                            {title.kind === 'movie' ? 'Film' : 'Serie'}
                            {' · '}
                            {mediaStatusLabels[title.status]}

                            {title.rating !== null && (
                                <>
                                    {' · '}
                                    {title.rating.toLocaleString('de-CH')}
                                    /10
                                </>
                            )}
                        </p>
                    </div>

                    <div className="page-heading">
                        <h2>Gedanken</h2>
                        <span className="count">{thoughts.length}</span>
                    </div>

                    {!workspace.loading && !workspace.needsReload && (
                        thoughts.length ? (
                            <ul className="thought-list">
                                {thoughts.map((thought) => (
                                    <li key={thought.id}>
                                        <article className="thought-card">
                                            {thought.heading && (
                                                <h3>{thought.heading}</h3>
                                            )}

                                            <time dateTime={thought.createdAt}>
                                                {new Date(
                                                    thought.createdAt,
                                                ).toLocaleString('de-CH', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </time>

                                            <p className="thought-body">
                                                {thought.body}
                                            </p>

                                            <div className="thought-actions">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setEditor({ thought })
                                                    }
                                                >
                                                    Bearbeiten
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDeleting(thought)
                                                    }
                                                >
                                                    Löschen
                                                </button>
                                            </div>
                                        </article>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="empty-state">
                                <p>Noch keine Gedanken.</p>
                            </div>
                        )
                    )}
                </main>
            </div>

            {editor && (
                <MediaThoughtDialog
                    titleId={title.id}
                    thought={editor.thought}
                    onSave={workspace.save}
                    onClose={() => setEditor(null)}
                />
            )}

            {deleting && (
                <Modal
                    title="Gedanke löschen?"
                    busy={workspace.saving}
                    onClose={() => setDeleting(null)}
                >
                    <p>
                        {deleting.heading || 'Diesen Gedanken'}
                        {' wirklich löschen?'}
                    </p>

                    <form onSubmit={(event) => {
                        event.preventDefault()

                        void workspace.remove(deleting).then(
                            (removed) => {
                                if (removed) setDeleting(null)
                            },
                        )
                    }}>
                        <button
                            type="submit"
                            className="media-delete"
                            disabled={workspace.saving}
                        >
                            Löschen
                        </button>
                    </form>
                </Modal>
            )}
        </ModalFeedbackContext.Provider>
    )
}