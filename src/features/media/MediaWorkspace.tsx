import { useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import { useAppNavigation } from '../../app/hooks/useAppNavigation'
import { supabaseMediaRepository } from '../../infrastructure/supabase/supabaseMediaRepository'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import { MediaTitleDialog } from './MediaTitleDialog'
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

    const [dialog, setDialog] = useState<{
        title?: MediaTitle
        status: MediaStatus
    } | null>(null)

    const busy = workspace.loading || workspace.saving
    const blocked = busy || workspace.needsReload

    const titles = workspace.titles
        .filter((title) => title.status === status)
        .sort((a, b) =>
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
                                <ul className="media-titles">
                                    {titles.map((title) => (
                                        <li key={title.id}>
                                            <MediaSwipeRow
                                                name={title.name}
                                                actions={actions(title)}
                                            >
                                                <div className="media-title">
                                                    <div className="media-title__text">
                                                        <strong>
                                                            {title.name}
                                                        </strong>

                                                        <span>
                                                            {title.kind === 'movie'
                                                                ? 'Film'
                                                                : 'Serie'}
                                                        </span>
                                                    </div>

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
                                                </div>
                                            </MediaSwipeRow>
                                        </li>
                                    ))}
                                </ul>
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