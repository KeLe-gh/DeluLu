import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { AppHeader } from '../../app/AppHeader'
import { editSharedRankingEntry } from '../../infrastructure/supabase/supabaseSharedRankingEdit'
import { addSharedRankingEntry } from '../../infrastructure/supabase/supabaseSharedRankingAdd'
import { supabaseProfileImageStore } from '../../infrastructure/supabase/supabaseProfileImageStore'
import {
    SharedRankingUnavailableError,
    sharedRankingImages,
    supabaseRankingSharing,
} from '../../infrastructure/supabase/supabaseRankingSharing'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { Modal } from '../../shared/components/Modal'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import type { RankingList } from '../../shared/types/list.types'
import { ProfileImageContext } from '../images/ProfileImageContext'
import { RankingEntryEditor } from '../rankings/components/RankingEntryEditor'
import { SortableRankingEntries } from '../rankings/components/SortableRankingEntries'
import {
    removeRankingEntry,
    reorderRankingEntries,
} from '../rankings/model/ranking.operations'
import { SharedRankingAddDialog } from './SharedRankingAddDialog'

type SharedRanking = Awaited<
    ReturnType<typeof supabaseRankingSharing.read>
>

function Entries({
                     ranking,
                     blocked,
                     epoch,
                     onEdit,
                     onSave,
                 }: {
    ranking: SharedRanking
    blocked: boolean
    epoch: number
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
                    <p className="empty-state">
                        Noch keine Einträge.
                    </p>
                ) : (
                    <SortableRankingEntries
                        key={epoch}
                        entries={ranking.list.entries}
                        getItemName={(id) =>
                            items.get(id)?.name ??
                            'Unbekanntes Profil'
                        }
                        getItemImageId={(id) =>
                            items.get(id)?.profileImageId ?? null
                        }
                        getItemBackgroundImageId={(id) =>
                            items.get(id)?.backgroundImageId ?? null
                        }
                        onEdit={onEdit}
                        onRemove={(entryId) =>
                            onSave(removeRankingEntry(ranking.list, {
                                entryId,
                                timestamp: new Date().toISOString(),
                            }))
                        }
                        onReorder={(entryId, toIndex) =>
                            onSave(reorderRankingEntries(ranking.list, {
                                entryId,
                                toIndex,
                                timestamp: new Date().toISOString(),
                            }))
                        }
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
                                            }: {
    id: string
    onBack: () => void
    navigate: (path: string, replace?: boolean) => void
}) {
    const [attempt, setAttempt] = useState(0)

    const [result, setResult] = useState<{
        attempt: number
        data: SharedRanking | null
    } | null>(null)

    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [needsReload, setNeedsReload] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [confirmLeave, setConfirmLeave] = useState(false)
    const [epoch, setEpoch] = useState(0)
    const working = useRef(false)

    const current =
        result?.attempt === attempt ? result : null

    const data = current?.data ?? null
    const loading = !current
    const blocked = loading || busy || needsReload

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
        let active = true

        void supabaseProfileImageStore.cleanupUnused().catch(
            (error) => {
                console.warn(
                    '[deluLu] Photo cleanup failed:',
                    error,
                )
            },
        )

        void supabaseRankingSharing.read(id).then(
            (data) => {
                if (active) {
                    setResult({ attempt, data })
                }
            },
            () => {
                if (active) {
                    setResult({ attempt, data: null })
                }
            },
        )

        return () => {
            active = false
        }
    }, [id, attempt])

    function reload() {
        if (working.current) return

        setEditingId(null)
        setCreateOpen(false)
        setConfirmLeave(false)
        setNeedsReload(false)
        setError('')
        setEpoch((value) => value + 1)
        setAttempt((value) => value + 1)
    }

    async function save(
        next: RankingList | null,
    ): Promise<boolean> {
        if (working.current || blocked || !data) return false

        if (!next) {
            setError(
                'Die Änderung ist so nicht möglich. Bitte prüfe die Position.',
            )
            return false
        }

        if (next === data.list) return true

        return perform(() =>
            supabaseRankingSharing.saveEntries(
                id,
                data.revision,
                next.entries,
            ),
        )
    }

    async function perform(
        action: () => Promise<void>,
    ): Promise<boolean> {
        if (working.current || blocked || !data) return false

        working.current = true
        setBusy(true)
        setError('')

        try {
            await action()

            const fresh = await supabaseRankingSharing.read(id)

            setResult({ attempt, data: fresh })
            setEditingId(null)
            setCreateOpen(false)

            return true
        } catch (failure) {
            if (failure instanceof SharedRankingUnavailableError) {
                setResult({ attempt, data: null })
                setEditingId(null)
                setCreateOpen(false)
            } else {
                setNeedsReload(true)

                setError(
                    failure instanceof RevisionConflictError
                        ? 'Jemand anderes hat die Liste geändert. Bitte lade sie erneut und führe deine Änderung noch einmal aus.'
                        : 'Der aktuelle Stand konnte nicht bestätigt werden. Bitte lade die Liste erneut.',
                )
            }

            return false
        } finally {
            setEpoch((value) => value + 1)
            working.current = false
            setBusy(false)
        }
    }

    async function leave() {
        if (working.current) return

        working.current = true
        setBusy(true)
        setError('')

        try {
            await supabaseRankingSharing.leave(id)
            navigate('/shared', true)
        } catch {
            setError(
                'Verlassen fehlgeschlagen. Bitte versuche es erneut.',
            )
        } finally {
            working.current = false
            setBusy(false)
        }
    }

    const feedback = (
        <>
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
    )

    return (
        <ModalFeedbackContext.Provider
            value={{ busy, blocked, content: feedback }}
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
                <h1>
                    {data?.list.title ?? 'Geteilte Liste'}
                </h1>

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
                            <button
                                type="button"
                                className="sharing-button"
                                disabled={busy}
                                onClick={() =>
                                    navigate('/rankings/' + id, true)
                                }
                            >
                                Eigene Liste öffnen
                            </button>
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

                {current && !data && (
                    <p role="alert">
                        Diese Liste ist gerade nicht verfügbar.
                        Prüfe deine Verbindung. Vielleicht wurde
                        sie gelöscht oder der Zugriff beendet.
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
                            onRemove={() =>
                                save(removeRankingEntry(data.list, {
                                    entryId: editing.id,
                                    timestamp: new Date().toISOString(),
                                }))
                            }
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

                {confirmLeave && (
                    <Modal
                        title="Liste verlassen?"
                        busy={busy}
                        onClose={() => setConfirmLeave(false)}
                    >
                        <div className="sharing-stack">
                            <p>
                                Die Liste bleibt für die anderen
                                erhalten. Mit einem gültigen
                                Einladungslink kannst du später
                                wieder beitreten.
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