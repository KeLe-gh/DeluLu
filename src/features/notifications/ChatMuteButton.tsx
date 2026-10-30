import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../infrastructure/supabase/client'
import { subscribeChatUpdates } from '../../infrastructure/supabase/subscribeListUpdates'
import type { ChatTarget } from '../chat/chat.types'
import { pushEnabled } from '../chat/chat.config'

export function ChatMuteButton({
                                   target,
                               }: {
    target: ChatTarget
}) {
    const [muted, setMuted] = useState<boolean | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const version = useRef(0)
    const working = useRef(false)

    useEffect(() => {
        if (!pushEnabled) return

        let active = true

        async function read() {
            const current = version.current

            const result = await supabase.rpc(
                'get_chat_push_muted',
                {
                    p_kind: target.kind,
                    p_list_id: target.id,
                },
            )

            if (
                active &&
                current === version.current &&
                !working.current &&
                !result.error
            ) {
                setMuted(result.data)
            }
        }

        void read()

        const stop = subscribeChatUpdates(
            () => { void read() },
            () => {},
        )

        return () => {
            active = false
            stop()
        }
    }, [target.kind, target.id])

    async function change() {
        if (working.current || muted === null) return

        working.current = true
        version.current += 1
        setBusy(true)
        setError('')

        try {
            const result = await supabase.rpc(
                'set_chat_push_muted',
                {
                    p_kind: target.kind,
                    p_list_id: target.id,
                    p_muted: !muted,
                },
            )

            if (result.error) throw result.error
            setMuted(result.data)
        } catch {
            setError(
                'Die Einstellung konnte nicht gespeichert werden.',
            )
        } finally {
            working.current = false
            setBusy(false)
        }
    }

    if (!pushEnabled) return null

    return (
        <>
            <button
                type="button"
                disabled={busy || muted === null}
                aria-pressed={muted ?? false}
                onClick={() => void change()}
            >
                {muted
                    ? 'Stummschaltung aufheben'
                    : 'Chat stummschalten'}
            </button>

            {error && <p role="alert">{error}</p>}
        </>
    )
}