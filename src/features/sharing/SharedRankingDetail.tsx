import { useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import { supabaseProfileImageStore } from '../../infrastructure/supabase/supabaseProfileImageStore'
import { editSharedRankingEntry } from '../../infrastructure/supabase/supabaseSharedRankingEdit'
import { addSharedRankingEntry } from '../../infrastructure/supabase/supabaseSharedRankingAdd'
import {
    sharedRankingImages,
    supabaseRankingSharing,
} from '../../infrastructure/supabase/supabaseRankingSharing'
import { Modal } from '../../shared/components/Modal'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import type { RankingList } from '../../shared/types/list.types'
import { ProfileImageContext } from '../images/ProfileImageContext'
import { RankingEntryEditor } from '../rankings/components/RankingEntryEditor'
import { RankingShareButton } from '../rankings/components/RankingShareButton'
import { SortableRankingEntries } from '../rankings/components/SortableRankingEntries'
import {
    getRankingSize,
    removeRankingEntry,
    reorderRankingEntries,
} from '../rankings/model/ranking.operations'
import { SharedRankingAddDialog } from './SharedRankingAddDialog'
import { useLiveList } from './hooks/useLiveList'

type SharedRanking =
    Awaited<ReturnType<typeof supabaseRankingSharing.read>>

function Entries({
                     ranking,
                     blocked,
                     epoch,
                     onEdit,
                     onSave,
                     onDragChange,
                 }: {
    ranking: SharedRanking
    blocked: boolean
    epoch: number
    onDragChange: (dragging: boolean) => void
    onEdit: (id: string) => void
    onSave: (next: RankingList | null) => Promise<boolean>
}) {
    const store = useMemo(
        () => sharedRankingImages(ranking.ownerId),
        [ranking.ownerId],
    )
    const items = new Map(
        ranking.items.map((item) => [item.id, item]),
    )

    return (
        <ProfileImageContext.Provider value={store}>
            <div inert={blocked}>
                {ranking.list.entries.length === 0 ? (
                    <p className="empty-state">Noch keine Einträge.</p>
                ) : (
                    <SortableRankingEntries
                        key={epoch}
                        onDragChange={onDragChange}
                        entries={ranking.list.entries}
                        getItemName={(id) =>
                            items.get(id)?.name ?? 'Unbekanntes Profil'
                        }
                        getItemImageId={(id) =>
                            items.get(id)?.profileImageId ?? null
                        }
                        getItemBackgroundImageId={(id) =>
                            items.get(id)?.backgroundImageId ?? null
                        }
                        onEdit={onEdit}
                        onRemove={(entryId) => onSave(
                            removeRankingEntry(ranking.list, {
                                entryId,
                                timestamp: new Date().toISOString(),
                            }),
                        )}
                        onReorder={(entryId, toIndex) => onSave(
                            reorderRankingEntries(ranking.list, {
                                entryId,
                                toIndex,
                                timestamp: new Date().toISOString(),
                            }),
                        )}
                    />
                )}
            </div>
        </ProfileImageContext.Provider>
    )
}

export default function SharedRankingDetail({
                                                id,
                                                navigate,
                                                onBack,
                                                owned = false,
                                            }: {
    owned?: boolean
    id: string
    onBack: () => void
    navigate: (path: string, replace?: boolean) => void
}) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [confirmLeave, setConfirmLeave] = useState(false)
    const [leaveError, setLeaveError] = useState('')
    const [leaving, setLeaving] = useState(false)
    const working = useRef(false)

    const live = useLiveList(
        id,
        supabaseRankingSharing.read,
        Boolean(editingId) || createOpen || confirmLeave,
        () => {
            setEditingId(null)
            setCreateOpen(false)
            setConfirmLeave(false)
        },
    )

    const {
        data,
        loading,
        busy,
        blocked,
        error,
        needsReload,
        epoch,
    } = live

    const editing = data?.list.entries.find(
        (entry) => entry.id === editingId,
    )
    const item = data?.items.find(
        (entry) => entry.id === editing?.itemId,
    )
    const imageOwner = data?.ownerId ?? ''
    const editingImages = useMemo(
        () => sharedRankingImages(imageOwner),
        [imageOwner],
    )

    useEffect(() => {
        void supabaseProfileImageStore.cleanupUnused().catch((cause) => {
            console.warn('[deluLu] Photo cleanup failed:', cause)
        })
    }, [])

    function reload() {
        if (busy || working.current) return
        setEditingId(null)
        setCreateOpen(false)
        setConfirmLeave(false)
        live.reload()
    }

    async function save(next: RankingList | null): Promise<boolean> {
        if (working.current || blocked || !data || !next) return false
        if (next === data.list) return true

        return perform(() => supabaseRankingSharing.saveEntries(
            id,
            data.revision,
            next.entries,
        ))
    }

    async function perform(
        action: () => Promise<void>,
    ): Promise<boolean> {
        const saved = await live.perform(action)

        if (saved) {
            setEditingId(null)
            setCreateOpen(false)
        }

        return saved
    }

    async function leave() {
        if (working.current) return

        working.current = true
        setLeaving(true)
        setLeaveError('')

        try {
            await supabaseRankingSharing.leave(id)
            navigate('/shared', true)
        } catch {
            setLeaveError(
                'Verlassen fehlgeschlagen. Bitte versuche es erneut.',
            )
        } finally {
            working.current = false
            setLeaving(false)
        }
    }

    const feedback = <>
        {live.offline && (
            <p className="field-hint">Live-Verbindung unterbrochen.</p>
        )}
        {live.changed && (
            <p role="status">
                Neue Änderungen vorhanden. Dein Entwurf bleibt erhalten.
            </p>
        )}
        {leaveError && <p role="alert">{leaveError}</p>}
        {busy && <p role="status">Speichern …</p>}
        {error && <p role="alert">{error}</p>}

        {needsReload && (
            <button
                type="button"
                className="sharing-button"
                disabled={busy}
                onClick={reload}
            >
                Liste erneut laden
            </button>
        )}
    </>

    return (
        <ModalFeedbackContext.Provider
            value={{
                busy: busy || leaving,
                blocked: blocked || leaving,
                content: feedback,
            }}
        >
            <AppHeader
                onHome={() => navigate('/')}
                onBack={onBack}
                onAdd={
                    data && !blocked
                        ? () => setCreateOpen(true)
                        : undefined
                }
                addLabel="Eintrag hinzufügen"
            />

            <main className="page">
                <div className="page-heading">
                    <h1>{data?.list.title ?? 'Top-Liste'}</h1>
                    {data && (
                        <span className="count">
                            {data.list.entries.length
                                ? 'Top ' + getRankingSize(data.list)
                                : 'Leer'}
                        </span>
                    )}
                </div>

                <div className="sharing-actions">
                    <button
                        type="button"
                        className="sharing-button"
                        disabled={loading || busy}
                        onClick={reload}
                    >
                        Aktualisieren
                    </button>

                    {data && (
                        data.isOwner ? (
                            owned ? (
                                <div inert={blocked}>
                                    <RankingShareButton listId={id} />
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="sharing-button"
                                    disabled={busy}
                                    onClick={() => navigate(
                                        '/rankings/' + id,
                                        true,
                                    )}
                                >
                                    Eigene Liste öffnen
                                </button>
                            )
                        ) : (
                            <button
                                type="button"
                                className="sharing-button"
                                disabled={busy}
                                onClick={() => setConfirmLeave(true)}
                            >
                                Liste verlassen …
                            </button>
                        )
                    )}
                </div>

                {loading && (
                    <p role="status">Liste wird geladen …</p>
                )}

                {!loading && !data && (
                    <p role="alert">
                        Diese Liste ist gerade nicht verfügbar.
                        Prüfe deine Verbindung.
                        Vielleicht wurde sie gelöscht oder der Zugriff beendet.
                    </p>
                )}

                {!editing && !confirmLeave && !createOpen && feedback}

                {data && (
                    <Entries
                        ranking={data}
                        blocked={blocked}
                        epoch={epoch}
                        onEdit={setEditingId}
                        onSave={save}
                        onDragChange={live.onDragChange}
                    />
                )}

                {data && editing && item && (
                    <ProfileImageContext.Provider value={editingImages}>
                        <RankingEntryEditor
                            key={editing.id}
                            name={item.name}
                            position={editing.position}
                            imageId={item.profileImageId}
                            backgroundImageId={item.backgroundImageId}
                            onSave={(name, position, photo, background) =>
                                perform(() => editSharedRankingEntry({
                                    listId: id,
                                    revision: data.revision,
                                    entryId: editing.id,
                                    catalogRevision:
                                        data.catalogRevisions[item.id],
                                    name,
                                    position,
                                    photo,
                                    background,
                                }))
                            }
                            onRemove={() => save(
                                removeRankingEntry(data.list, {
                                    entryId: editing.id,
                                    timestamp: new Date().toISOString(),
                                }),
                            )}
                            onCancel={() => setEditingId(null)}
                        />
                    </ProfileImageContext.Provider>
                )}

                {data && createOpen && (
                    <SharedRankingAddDialog
                        list={data.list}
                        onNew={(name, position, photo, background) =>
                            perform(() => addSharedRankingEntry({
                                listId: id,
                                ownerId: data.ownerId,
                                revision: data.revision,
                                name,
                                position,
                                photo,
                                background,
                            }))
                        }
                        onExisting={(source, position) =>
                            perform(() => addSharedRankingEntry({
                                listId: id,
                                ownerId: data.ownerId,
                                revision: data.revision,
                                source,
                                position,
                            }))
                        }
                        onClose={() => setCreateOpen(false)}
                    />
                )}

                {data && confirmLeave && (
                    <Modal
                        title="Liste verlassen?"
                        busy={busy || leaving}
                        onClose={() => setConfirmLeave(false)}
                    >
                        <div className="sharing-stack">
                            <p>
                                Die Liste bleibt für die anderen erhalten.
                                Mit einem gültigen Einladungslink kannst du
                                später wieder beitreten.
                            </p>
                            <button
                                type="button"
                                className="modal__danger"
                                onClick={() => void leave()}
                            >
                                Liste verlassen
                            </button>
                        </div>
                    </Modal>
                )}
            </main>
        </ModalFeedbackContext.Provider>
    )
}