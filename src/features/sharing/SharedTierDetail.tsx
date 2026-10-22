import { supabaseProfileImageStore } from '../../infrastructure/supabase/supabaseProfileImageStore'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import { supabaseTierSharing as service } from '../../infrastructure/supabase/supabaseTierSharing'
import { sharedRankingImages } from '../../infrastructure/supabase/supabaseRankingSharing'
import { useLiveList } from './hooks/useLiveList'
import { Modal } from '../../shared/components/Modal'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import { ProfileImageContext } from '../images/ProfileImageContext'
import { RankingShareButton } from '../rankings/components/RankingShareButton'
import { TierEntryEditor } from '../tiers/TierEntryEditor'
import { TierLabelEditor } from '../tiers/TierLabelEditor'
import { TierListView } from '../tiers/TierListView'
import { SharedTierAddDialog } from './SharedTierAddDialog'
import '../tiers/Tiers.css'
import './Sharing.css'

export default function SharedTierDetail({
                                             id,
                                             navigate,
                                             onBack,
                                         }: {
    id: string
    navigate: (path: string, replace?: boolean) => void
    onBack: () => void
}) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [adding, setAdding] = useState(false)
    const [leaving, setLeaving] = useState(false)

    const live = useLiveList(
        id,
        service.read,
        Boolean(editingId) || Boolean(renamingId) || adding || leaving,
        () => {
            setEditingId(null)
            setRenamingId(null)
            setAdding(false)
            setLeaving(false)
        },
    )

    const {
        data,
        loading,
        busy,
        blocked,
        needsReload,
        error,
        epoch,
    } = live

    const working = useRef(false)
    const [leaveError, setLeaveError] = useState('')
    const [leaveBusy, setLeaveBusy] = useState(false)

    const pointer = useRef<{
        x: number
        y: number
        moved: boolean
    } | null>(null)

    const editing = data?.list.entries.find(
        (entry) => entry.id === editingId,
    )

    const renaming = data?.list.tiers.find(
        (tier) => tier.id === renamingId,
    )

    const item = data?.items.find(
        (item) => item.id === editing?.itemId,
    )

    const ownerId = data?.ownerId ?? ''

    const images = useMemo(
        () => sharedRankingImages(ownerId),
        [ownerId],
    )

    useEffect(() => {
        void supabaseProfileImageStore.cleanupUnused().catch((cause) => {
            console.warn('[deluLu] Photo cleanup failed:', cause)
        })
    }, [])

    function reload() {
        if (busy || working.current) return

        setAdding(false)
        setEditingId(null)
        setRenamingId(null)
        setLeaving(false)
        setLeaveError('')
        live.reload()
    }

    async function perform(
        action: () => Promise<void>,
    ): Promise<boolean> {
        const saved = await live.perform(action)

        if (saved) {
            setEditingId(null)
            setRenamingId(null)
            setAdding(false)
        }

        return saved
    }

    async function leave() {
        if (working.current) return

        working.current = true
        setLeaveBusy(true)
        setLeaveError('')

        try {
            await service.leave(id)
            navigate('/shared', true)
        } catch {
            setLeaveError(
                'Verlassen fehlgeschlagen. Bitte versuche es erneut.',
            )
        } finally {
            working.current = false
            setLeaveBusy(false)
        }
    }

    const feedback = <>
        {live.offline && (
            <p className="field-hint">
                Live-Verbindung unterbrochen.
            </p>
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

    const boardBlocked =
        blocked ||
        adding ||
        Boolean(editing) ||
        Boolean(renaming) ||
        leaving

    return (
        <ModalFeedbackContext.Provider value={{
            busy: busy || leaveBusy,
            blocked: blocked || leaveBusy,
            content: feedback,
        }}>
            <AppHeader
                onHome={() => navigate('/')}
                onBack={onBack}
                onAdd={data && !blocked
                    ? () => setAdding(true)
                    : undefined
                }
                addLabel="Eintrag hinzufügen"
            />

            <main className="page">
                <h1>{data?.list.title ?? 'Tierliste'}</h1>

                <div className="sharing-actions">
                    <button
                        type="button"
                        className="sharing-button"
                        disabled={loading || busy}
                        onClick={reload}
                    >
                        Aktualisieren
                    </button>

                    {data?.isOwner && (
                        <div inert={blocked}>
                            <RankingShareButton listId={id} kind="tier" />
                        </div>
                    )}

                    {data && !data.isOwner && (
                        <button
                            type="button"
                            className="sharing-button"
                            disabled={busy}
                            onClick={() => setLeaving(true)}
                        >
                            Liste verlassen …
                        </button>
                    )}
                </div>

                {loading && <p role="status">Liste wird geladen …</p>}

                {!loading && !data && (
                    <p role="alert">
                        Diese Liste ist gerade nicht verfügbar.
                        Prüfe deine Verbindung. Vielleicht wurde sie
                        gelöscht oder der Zugriff beendet.
                    </p>
                )}

                {!adding && !editing && !renaming && !leaving && feedback}

                {data && (
                    <ProfileImageContext.Provider value={images}>
                        <div
                            inert={boardBlocked}
                            onPointerDownCapture={(event) => {
                                pointer.current = {
                                    x: event.clientX,
                                    y: event.clientY,
                                    moved: false,
                                }
                            }}
                            onPointerMoveCapture={(event) => {
                                const start = pointer.current

                                if (start && Math.hypot(
                                    event.clientX - start.x,
                                    event.clientY - start.y,
                                ) >= 5) {
                                    start.moved = true
                                }
                            }}
                            onPointerCancelCapture={() => {
                                if (pointer.current) {
                                    pointer.current.moved = true
                                }
                            }}
                            onClickCapture={(event) => {
                                if (
                                    blocked ||
                                    pointer.current?.moved ||
                                    !(event.target instanceof Element)
                                ) return

                                const tile = event.target.closest<HTMLElement>(
                                    '[data-tier-entry],[data-cake-entry]',
                                )

                                const entryId =
                                    tile?.dataset.tierEntry ??
                                    tile?.dataset.cakeEntry

                                if (entryId) setEditingId(entryId)
                            }}
                        >
                            <TierListView
                                key={epoch}
                                list={data.list}
                                items={data.items}
                                disabled={boardBlocked}
                                onDragChange={live.onDragChange}
                                onRenameTier={setRenamingId}
                                onMove={async (entryId, tierId, index) => {
                                    if (pointer.current) {
                                        pointer.current.moved = true
                                    }

                                    await perform(() =>
                                        service.move(
                                            id,
                                            data.revision,
                                            entryId,
                                            tierId,
                                            index,
                                        ),
                                    )
                                }}
                            />
                        </div>

                        {editing && item && (
                            <TierEntryEditor
                                key={editing.id}
                                item={item}
                                canEditProfile={
                                    data.editableItemIds.includes(item.id)
                                }
                                onSave={(name, photo, background) =>
                                    perform(() => service.edit(
                                        id,
                                        data.revision,
                                        editing.id,
                                        data.catalogRevisions[item.id],
                                        name,
                                        photo,
                                        background,
                                    ))
                                }
                                onRemove={() =>
                                    perform(() =>
                                        service.remove(
                                            id,
                                            data.revision,
                                            editing.id,
                                        ),
                                    )
                                }
                                onClose={() => setEditingId(null)}
                            />
                        )}
                    </ProfileImageContext.Provider>
                )}

                {data && renaming && (
                    <TierLabelEditor
                        key={renaming.id}
                        label={renaming.label}
                        onSave={(label) =>
                            perform(() =>
                                service.renameRow(
                                    id,
                                    data.revision,
                                    renaming.id,
                                    label,
                                ),
                            )
                        }
                        onClose={() => setRenamingId(null)}
                    />
                )}

                {data && adding && (
                    <SharedTierAddDialog
                        list={data.list}
                        onClose={() => setAdding(false)}
                        onAdd={(draft, source) =>
                            perform(() =>
                                service.add(
                                    id,
                                    data.ownerId,
                                    data.revision,
                                    draft,
                                    source,
                                ),
                            )
                        }
                    />
                )}

                {data && leaving && (
                    <Modal
                        title="Liste verlassen?"
                        busy={busy || leaveBusy}
                        onClose={() => setLeaving(false)}
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