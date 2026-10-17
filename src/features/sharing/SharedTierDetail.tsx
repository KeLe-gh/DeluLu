import { useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import { supabaseTierSharing as service } from '../../infrastructure/supabase/supabaseTierSharing'
import {
    sharedRankingImages,
    SharedRankingUnavailableError,
} from '../../infrastructure/supabase/supabaseRankingSharing'
import { supabaseProfileImageStore } from '../../infrastructure/supabase/supabaseProfileImageStore'
import { RevisionConflictError } from '../../shared/errors/persistence.errors'
import { Modal } from '../../shared/components/Modal'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import { ProfileImageContext } from '../images/ProfileImageContext'
import { RankingShareButton } from '../rankings/components/RankingShareButton'
import { TierEntryEditor } from '../tiers/TierEntryEditor'
import { TierListView } from '../tiers/TierListView'
import { SharedTierAddDialog } from './SharedTierAddDialog'
import '../tiers/Tiers.css'
import './Sharing.css'

type Snapshot = Awaited<ReturnType<typeof service.read>>

export default function SharedTierDetail({
                                             id,
                                             navigate,
                                             onBack,
                                         }: {
    id: string
    navigate: (path: string, replace?: boolean) => void
    onBack: () => void
}) {
    const [attempt, setAttempt] = useState(0)
    const [result, setResult] = useState<{
        attempt: number
        data: Snapshot | null
    } | null>(null)

    const [busy, setBusy] = useState(false)
    const [needsReload, setNeedsReload] = useState(false)
    const [error, setError] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [adding, setAdding] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [epoch, setEpoch] = useState(0)

    const working = useRef(false)
    const pointer = useRef<{
        x: number
        y: number
        moved: boolean
    } | null>(null)

    const current = result?.attempt === attempt ? result : null
    const data = current?.data ?? null
    const loading = !current
    const blocked = loading || busy || needsReload

    const editing = data?.list.entries.find(
        (entry) => entry.id === editingId,
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
        let active = true

        void service.read(id).then(
            (data) => {
                if (active) setResult({ attempt, data })
            },
            () => {
                if (active) setResult({ attempt, data: null })
            },
        )

        void supabaseProfileImageStore.cleanupUnused().catch((cause) => {
            console.warn('[deluLu] Photo cleanup failed:', cause)
        })

        return () => {
            active = false
        }
    }, [id, attempt])

    function reload() {
        if (working.current) return

        setAdding(false)
        setEditingId(null)
        setLeaving(false)
        setError('')
        setNeedsReload(false)
        setEpoch((value) => value + 1)
        setAttempt((value) => value + 1)
    }

    async function perform(action: () => Promise<void>): Promise<boolean> {
        if (working.current || blocked || !data) return false

        working.current = true
        setBusy(true)
        setError('')

        try {
            await action()
            const fresh = await service.read(id)

            setResult({ attempt, data: fresh })
            setEditingId(null)
            setAdding(false)

            return true
        } catch (failure) {
            if (failure instanceof SharedRankingUnavailableError) {
                setResult({ attempt, data: null })
                setEditingId(null)
                setAdding(false)
            } else {
                setNeedsReload(true)
                setError(
                    failure instanceof RevisionConflictError
                        ? 'Jemand anderes hat die Liste oder das Profil geändert. Bitte lade den aktuellen Stand.'
                        : 'Der aktuelle Stand konnte nicht bestätigt werden. Bitte lade die Liste erneut.',
                )
            }

            return false
        } finally {
            working.current = false
            setBusy(false)
            setEpoch((value) => value + 1)
        }
    }

    async function leave() {
        if (working.current) return

        working.current = true
        setBusy(true)
        setError('')

        try {
            await service.leave(id)
            navigate('/shared', true)
        } catch {
            setError('Verlassen fehlgeschlagen. Bitte versuche es erneut.')
        } finally {
            working.current = false
            setBusy(false)
        }
    }

    const feedback = <>
        {busy && <p role="status">Speichern …</p>}
        {error && <p role="alert">{error}</p>}

        {needsReload && <button
            type="button"
            className="sharing-button"
            disabled={busy}
            onClick={reload}
        >
            Liste erneut laden
        </button>}
    </>

    return <ModalFeedbackContext.Provider
        value={{ busy, blocked, content: feedback }}
    >
        <AppHeader
            onHome={() => navigate('/')}
            onBack={onBack}
            onAdd={data && !blocked ? () => setAdding(true) : undefined}
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

                {data?.isOwner && <div inert={blocked}>
                    <RankingShareButton listId={id} kind="tier" />
                </div>}

                {data && !data.isOwner && <button
                    type="button"
                    className="sharing-button"
                    disabled={busy}
                    onClick={() => setLeaving(true)}
                >
                    Liste verlassen …
                </button>}
            </div>

            {loading && <p role="status">Liste wird geladen …</p>}

            {current && !data && <p role="alert">
                Diese Liste ist gerade nicht verfügbar.
                Prüfe deine Verbindung.
                Vielleicht wurde sie gelöscht oder der Zugriff beendet.
            </p>}

            {!adding && !editing && !leaving && feedback}

            {data && <ProfileImageContext.Provider value={images}>
                <div
                    inert={blocked || adding || Boolean(editing) || leaving}
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
                        if (pointer.current) pointer.current.moved = true
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
                        disabled={
                            blocked ||
                            adding ||
                            Boolean(editing) ||
                            leaving
                        }
                        onMove={async (entryId, tierId, index) => {
                            if (pointer.current) {
                                pointer.current.moved = true
                            }

                            await perform(() => service.move(
                                id,
                                data.revision,
                                entryId,
                                tierId,
                                index,
                            ))
                        }}
                    />
                </div>

                {editing && item && <TierEntryEditor
                    key={editing.id}
                    item={item}
                    onSave={(name, photo, background) => perform(
                        () => service.edit(
                            id,
                            data.revision,
                            editing.id,
                            data.catalogRevisions[item.id],
                            name,
                            photo,
                            background,
                        ),
                    )}
                    onRemove={() => perform(() => service.remove(
                        id,
                        data.revision,
                        editing.id,
                    ))}
                    onClose={() => setEditingId(null)}
                />}
            </ProfileImageContext.Provider>}

            {data && adding && <SharedTierAddDialog
                list={data.list}
                onClose={() => setAdding(false)}
                onAdd={(draft, source) => perform(() => service.add(
                    id,
                    data.ownerId,
                    data.revision,
                    draft,
                    source,
                ))}
            />}

            {leaving && <Modal
                title="Liste verlassen?"
                busy={busy}
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
            </Modal>}
        </main>
    </ModalFeedbackContext.Provider>
}