import { useRef, useState } from 'react'
import { supabaseTierSharing } from '../../../infrastructure/supabase/supabaseTierSharing'
import { supabaseRankingSharing } from '../../../infrastructure/supabase/supabaseRankingSharing'
import { Modal } from '../../../shared/components/Modal'
import '../../sharing/Sharing.css'

export function RankingShareButton({
                                       listId,
                                       kind = 'ranking',
                                   }: {
    listId: string
    kind?: 'ranking' | 'tier'
}) {
    const [open, setOpen] = useState(false)

    return <>
        <button
            type="button"
            className="sharing-button"
            onClick={() => setOpen(true)}
        >
            Liste teilen
        </button>

        {open && <ShareDialog
            service={
                kind === 'tier'
                    ? supabaseTierSharing
                    : supabaseRankingSharing
            }
            listId={listId}
            onClose={() => setOpen(false)}
        />}
    </>
}

function ShareDialog({
                         listId,
                         service,
                         onClose,
                     }: {
    listId: string
    service: Pick<typeof supabaseRankingSharing, 'stop' | 'createLink'>
    onClose: () => void
}) {
    const [link, setLink] = useState('')
    const [busy, setBusy] = useState(false)
    const [confirmStop, setConfirmStop] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const working = useRef(false)

    async function run(action: () => Promise<void>) {
        if (working.current) return
        working.current = true
        setBusy(true)
        setError('')
        setMessage('')

        try {
            await action()
        } catch {
            setError('Das hat nicht geklappt. Bitte versuche es erneut.')
        } finally {
            working.current = false
            setBusy(false)
        }
    }

    return <Modal title="Liste teilen" busy={busy} onClose={onClose}>
        <div className="sharing-stack">
            {confirmStop ? <>
                <p>
                    Alle Mitglieder verlieren den Zugriff.
                    Der Einladungslink wird ungültig.
                    Deine Liste bleibt erhalten.
                </p>

                <button
                    type="button"
                    className="modal__danger"
                    onClick={() => void run(async () => {
                        setLink('')
                        await service.stop(listId)
                        setConfirmStop(false)
                        setMessage('Die Liste wird nicht mehr geteilt.')
                    })}
                >
                    Teilen beenden
                </button>

                <button
                    type="button"
                    onClick={() => setConfirmStop(false)}
                >
                    Zurück
                </button>
            </> : <>
                <p>
                    Wer diesen Link hat, kann mit einem deluLu-Konto beitreten.
                </p>

                {link ? <>
                    <label htmlFor="ranking-share-link">
                        Einladungslink
                    </label>

                    <input
                        id="ranking-share-link"
                        value={link}
                        readOnly
                        onFocus={(event) => event.currentTarget.select()}
                    />

                    <button
                        type="button"
                        onClick={() => void run(async () => {
                            await navigator.clipboard.writeText(link)
                            setMessage('Link kopiert 💜')
                        })}
                    >
                        Link kopieren
                    </button>
                </> : <button
                    type="button"
                    onClick={() => void run(async () => {
                        setLink(await service.createLink(listId))
                    })}
                >
                    Einladungslink anzeigen
                </button>}

                <button
                    type="button"
                    className="modal__danger"
                    onClick={() => setConfirmStop(true)}
                >
                    Teilen beenden …
                </button>
            </>}

            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}
        </div>
    </Modal>
}