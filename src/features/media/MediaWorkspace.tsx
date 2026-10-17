import { useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import { useAppNavigation } from '../../app/hooks/useAppNavigation'
import { supabaseMediaRepository } from '../../infrastructure/supabase/supabaseMediaRepository'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import { orderedMedia } from './mediaOrder'
import { SortableMediaItems } from './SortableMediaItems'
import { MediaTitleDialog } from './MediaTitleDialog'
import { MediaThoughts } from './MediaThoughts'
import { MediaSwipeRow } from './MediaSwipeRow'
import type { MediaAction } from './MediaSwipeRow'
import type {
    MediaRepository,
    MediaStatus,
    MediaTitle,
} from './media.types'
import {
    mediaStatuses,
    mediaStatusFromPath,
    mediaStatusLabels,
} from './media.types'
import { useMediaTitles } from './useMediaTitles'
import './Media.css'

export function MediaScreen({
                                repository,
                                path,
                                onNavigate,
                                onBack,
                            }: {
    repository: MediaRepository
    path: string
    onNavigate: (path: string) => void
    onBack: (path: string) => void
}) {
    const workspace = useMediaTitles(repository)
    const status = mediaStatusFromPath(path)

    const detailId = path.match(
        /^\/media\/(?:watchlist|watching|watched|dropped)\/([^/]+)$/,
    )?.[1]

    const selectedTitle = workspace.titles.find(
        (title) => title.id === detailId,
    )

    const [dialog, setDialog] = useState<{
        title?: MediaTitle
        status: MediaStatus
    } | null>(null)

    const busy = workspace.loading || workspace.saving
    const blocked = busy || workspace.needsReload

    const titles = orderedMedia(
        workspace.titles.filter((title) => title.status === status),
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
                            ? 'Wird geladen …'
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
                        onClick={() => void workspace.reload()}
                    >
                        Daten erneut laden
                    </button>
                )}
            </section>
        ) : null

    function actions(title: MediaTitle): MediaAction[] {
        const result: MediaAction[] = [
            {
                label: 'Bearbeiten',
                run: () => setDialog({ title, status }),
            },
        ]

        const targets: MediaStatus[] =
            title.status === 'watchlist'
                ? ['watching']
                : title.status === 'watching'
                    ? ['watched', 'dropped']
                    : []

        for (const target of targets) {
            result.push({
                label: mediaStatusLabels[target],
                run: () => {
                    void workspace.save(
                        { ...title, status: target },
                        title.revision,
                    )
                },
            })
        }

        return result
    }

    if (detailId && workspace.loaded) {
        return (
            <ModalFeedbackContext.Provider
                value={{ busy, blocked, content: feedback }}
            >
                <div className="app-shell">
                    {feedback}

                    <div inert={blocked} aria-busy={busy}>
                        {selectedTitle ? (
                            <MediaThoughts
                                key={selectedTitle.id}
                                title={selectedTitle}
                                onHome={() => onNavigate('/')}
                                onBack={() =>
                                    onBack('/media/' + status)
                                }
                            />
                        ) : (
                            <>
                                <AppHeader
                                    onHome={() => onNavigate('/')}
                                    onBack={() =>
                                        onBack('/media/' + status)
                                    }
                                />
                                <main className="page">
                                    <h1>Eintrag nicht verfügbar</h1>
                                </main>
                            </>
                        )}
                    </div>
                </div>
            </ModalFeedbackContext.Provider>
        )
    }

    return (
        <ModalFeedbackContext.Provider
            value={{ busy, blocked, content: feedback }}
        >
            <div className="app-shell">
                {feedback}

                <div inert={blocked} aria-busy={busy}>
                    <AppHeader
                        onHome={() => onNavigate('/')}
                        onBack={() => onBack('/')}
                        onAdd={
                            workspace.loaded
                                ? () => setDialog({ status })
                                : undefined
                        }
                        addLabel="Serie oder Film hinzufügen"
                    />

                    <main className="page">
                        <div className="page-heading">
                            <h1>Serien/Filme</h1>
                        </div>

                        <nav
                            className="media-tabs"
                            aria-label="Serien und Filme filtern"
                        >
                            {mediaStatuses.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-current={
                                        status === value
                                            ? 'page'
                                            : undefined
                                    }
                                    onClick={() => {
                                        setDialog(null)
                                        onNavigate('/media/' + value)
                                    }}
                                >
                                    {mediaStatusLabels[value]}
                                </button>
                            ))}
                        </nav>

                        {workspace.loaded && (
                            titles.length ? (
                                <SortableMediaItems
                                    key={status}
                                    items={titles}
                                    className="media-titles"
                                    onReorder={(id, index) =>
                                        workspace.reorder(status, id, index)
                                    }
                                    render={(title, index, handle) => (
                                        <MediaSwipeRow
                                            name={title.name}
                                            actions={actions(title)}
                                        >
                                            <button
                                                type="button"
                                                className="media-title"
                                                aria-label={title.name + ' öffnen'}
                                                onClick={() =>
                                                    onNavigate(
                                                        '/media/' + status + '/' + title.id,
                                                    )
                                                }
                                            >
                                                {status === 'watchlist' && (
                                                    <span
                                                        className="media-title__number"
                                                        aria-hidden="true"
                                                    >
                                                        {index + 1}.
                                                    </span>
                                                )}

                                                <span className="media-title__text">
                                                    <strong>{title.name}</strong>
                                                    <span>
                                                        {title.kind === 'movie'
                                                            ? 'Film'
                                                            : 'Serie'}
                                                    </span>
                                                </span>

                                                {title.rating !== null && (
                                                    <span
                                                        className="media-title__rating"
                                                        aria-label={
                                                            'Bewertung: ' +
                                                            title.rating +
                                                            ' von 10'
                                                        }
                                                    >
                                                        {title.rating.toLocaleString(
                                                            'de-CH',
                                                            {
                                                                maximumFractionDigits: 1,
                                                            },
                                                        )}
                                                        <small>/10</small>
                                                    </span>
                                                )}
                                            </button>

                                            {handle}
                                        </MediaSwipeRow>
                                    )}
                                />
                            ) : (
                                <div className="empty-state">
                                    <p>Noch keine Einträge.</p>
                                </div>
                            )
                        )}
                    </main>
                </div>

                {dialog && (
                    <MediaTitleDialog
                        title={dialog.title}
                        status={dialog.status}
                        onSave={workspace.save}
                        onDelete={workspace.remove}
                        onClose={() => setDialog(null)}
                    />
                )}
            </div>
        </ModalFeedbackContext.Provider>
    )
}

export default function MediaWorkspace() {
    const navigation = useAppNavigation()

    return (
        <MediaScreen
            repository={supabaseMediaRepository}
            path={navigation.path}
            onNavigate={navigation.navigate}
            onBack={navigation.back}
        />
    )
}