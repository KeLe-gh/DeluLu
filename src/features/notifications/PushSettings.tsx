import { useEffect, useRef, useState } from 'react'
import { pushEnabled } from '../chat/chat.config'
import {
    devicePushStatus,
    disableDevicePush,
    enableDevicePush,
    needsHomeScreen,
    supportsPush,
} from './pushDevice'

export function PushSettings({ userId }: { userId: string }) {
    const [enabled, setEnabled] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const working = useRef(false)
    const version = useRef(0)

    useEffect(() => {
        if (
            !pushEnabled ||
            !supportsPush() ||
            needsHomeScreen()
        ) {
            return
        }

        let active = true

        async function refresh() {
            const current = version.current

            try {
                const value = await devicePushStatus(userId)

                if (
                    active &&
                    current === version.current &&
                    !working.current
                ) {
                    setEnabled(value)
                }
            } catch {
                // Keep the last state; the action can be retried.
            }
        }

        void refresh()

        window.addEventListener('focus', refresh)
        window.addEventListener('delulu:push-changed', refresh)

        return () => {
            active = false
            window.removeEventListener('focus', refresh)
            window.removeEventListener(
                'delulu:push-changed',
                refresh,
            )
        }
    }, [userId])

    async function change() {
        if (working.current) return

        working.current = true
        version.current += 1
        setBusy(true)
        setError('')

        try {
            if (enabled) {
                await disableDevicePush()
            } else {
                await enableDevicePush(userId)
            }

            setEnabled(!enabled)
        } catch {
            setError(
                Notification.permission === 'denied'
                    ? 'Benachrichtigungen sind blockiert. Erlaube sie in den Geräte- oder Browsereinstellungen für deluLu.'
                    : 'Das hat nicht geklappt. Bitte versuche es erneut.',
            )
        } finally {
            working.current = false
            setBusy(false)
        }
    }

    if (!pushEnabled) return null

    if (needsHomeScreen()) {
        return (
            <p className="field-hint">
                Füge deluLu zum Home-Bildschirm hinzu und öffne es
                über das App-Symbol, um Benachrichtigungen zu aktivieren.
            </p>
        )
    }

    if (!supportsPush()) {
        return (
            <p className="field-hint">
                Push-Benachrichtigungen sind auf diesem Gerät
                nicht verfügbar.
            </p>
        )
    }

    return (
        <section
            style={{ marginBlock: '1rem' }}
            aria-label="Benachrichtigungen"
        >
            <p className="field-hint">
                Benachrichtigungen auf diesem Gerät
            </p>

            <button
                type="button"
                disabled={busy}
                onClick={() => void change()}
            >
                {busy
                    ? 'Einen Moment …'
                    : enabled
                        ? 'Benachrichtigungen deaktivieren'
                        : 'Benachrichtigungen aktivieren'}
            </button>

            {error && <p role="alert">{error}</p>}
        </section>
    )
}