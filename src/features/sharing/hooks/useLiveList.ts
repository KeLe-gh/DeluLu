import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { subscribeListUpdates } from '../../../infrastructure/supabase/subscribeListUpdates'
import { SharedRankingUnavailableError } from '../../../infrastructure/supabase/supabaseRankingSharing'
import { RevisionConflictError } from '../../../shared/errors/persistence.errors'

export function useLiveList<T>(
    id: string,
    read: (id: string) => Promise<T>,
    paused = false,
    onUnavailable?: () => void,
) {
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [needsReload, setNeedsReload] = useState(false)
    const [changed, setChanged] = useState(false)
    const [error, setError] = useState('')
    const [offline, setOffline] = useState(false)
    const [epoch, setEpoch] = useState(0)

    const runtime = useRef<{
        active: boolean
        sequence: number
        writing: boolean
        blocked: boolean
        paused: boolean
        dragging: boolean
        pointers: Set<number>
        pending: boolean
        force: boolean
        unavailable: () => void
        fingerprint: string
        pump: () => void
        refresh: () => void
    }>({
        active: false,
        sequence: 0,
        writing: false,
        blocked: false,
        paused,
        dragging: false,
        pointers: new Set(),
        pending: false,
        force: false,
        unavailable: () => {},
        fingerprint: '',
        pump: () => {},
        refresh: () => {},
    })

    useLayoutEffect(() => {
        runtime.current.unavailable = onUnavailable ?? (() => {})
    })

    useLayoutEffect(() => {
        const state = runtime.current
        state.paused = paused
        if (!paused) state.pump()
    }, [paused])

    useEffect(() => {
        const state = runtime.current
        state.active = true

        let active = true
        let timer: ReturnType<typeof setTimeout> | undefined
        let gestureTimer: ReturnType<typeof setTimeout> | undefined
        let reading = false
        let dirty = false
        let failures = 0

        const visible = () => document.visibilityState !== 'hidden'
        const holding = () =>
            state.paused ||
            state.dragging ||
            state.pointers.size > 0

        function accept(fresh: T) {
            const fingerprint = JSON.stringify(fresh)

            if (fingerprint !== state.fingerprint) {
                state.fingerprint = fingerprint
                setData(fresh)
                setEpoch((value) => value + 1)
            }

            state.pending = false
            state.force = false
            state.blocked = false

            setNeedsReload(false)
            setChanged(false)
            setError('')
        }

        async function refresh() {
            if (
                !active ||
                reading ||
                state.writing ||
                !visible()
            ) return

            reading = true
            dirty = false

            const sequence = state.sequence

            try {
                const fresh = await read(id)

                if (!active || sequence !== state.sequence) return

                failures = 0

                if (state.force && !holding()) {
                    accept(fresh)
                } else if (JSON.stringify(fresh) === state.fingerprint) {
                    state.pending = false
                    setChanged(false)
                    if (!state.blocked) setError('')
                } else if (holding() || state.blocked) {
                    // Keep the draft's original data and revisions.
                    state.pending = true
                    setChanged(true)
                } else {
                    accept(fresh)
                }
            } catch (cause) {
                if (!active || sequence !== state.sequence) return

                if (cause instanceof SharedRankingUnavailableError) {
                    state.fingerprint = ''
                    state.pending = false
                    state.force = false

                    setData(null)
                    state.unavailable()
                    setChanged(false)
                    setError(
                        'Diese Liste wurde gelöscht oder dein Zugriff wurde beendet.',
                    )
                } else {
                    setError(
                        'Aktualisieren fehlgeschlagen. Bitte prüfe deine Verbindung.',
                    )
                    failures += 1
                    dirty = true
                }
            } finally {
                reading = false

                if (active) {
                    setLoading(false)

                    if (dirty) {
                        schedule(
                            failures
                                ? Math.min(
                                    30000,
                                    1500 * 2 ** Math.min(failures, 4),
                                )
                                : 180,
                        )
                    }
                }
            }
        }

        function schedule(delay = 180) {
            clearTimeout(timer)
            timer = setTimeout(() => void refresh(), delay)
        }

        function request() {
            dirty = true
            if (visible()) schedule()
        }

        state.refresh = request
        state.pump = () => {
            if (
                (state.pending || dirty) &&
                !holding() &&
                (state.force || !state.blocked)
            ) {
                request()
            }
        }

        const resume = () => {
            if (visible()) request()
        }

        const down = (event: PointerEvent) => {
            state.pointers.add(event.pointerId)
        }

        const up = (event: PointerEvent) => {
            state.pointers.delete(event.pointerId)
            clearTimeout(gestureTimer)
            gestureTimer = setTimeout(() => state.pump(), 220)
        }

        const blur = () => {
            state.pointers.clear()
            state.dragging = false
        }

        const stop = subscribeListUpdates(
            request,
            (connected) => {
                if (active) setOffline(!connected)
            },
        )

        window.addEventListener('pointerdown', down, true)
        window.addEventListener('pointerup', up, true)
        window.addEventListener('pointercancel', up, true)
        window.addEventListener('blur', blur)
        window.addEventListener('focus', resume)
        window.addEventListener('online', resume)
        window.addEventListener('pageshow', resume)
        document.addEventListener('visibilitychange', resume)

        void refresh()

        return () => {
            active = false
            state.active = false
            state.sequence += 1

            stop()
            clearTimeout(timer)
            clearTimeout(gestureTimer)

            window.removeEventListener('pointerdown', down, true)
            window.removeEventListener('pointerup', up, true)
            window.removeEventListener('pointercancel', up, true)
            window.removeEventListener('blur', blur)
            window.removeEventListener('focus', resume)
            window.removeEventListener('online', resume)
            window.removeEventListener('pageshow', resume)
            document.removeEventListener('visibilitychange', resume)
        }
    }, [id, read])

    async function perform(
        action: () => Promise<void>,
    ): Promise<boolean> {
        const state = runtime.current

        if (
            !state.active ||
            state.writing ||
            state.blocked ||
            loading ||
            !data
        ) return false

        state.writing = true
        const sequence = ++state.sequence

        setBusy(true)
        setError('')

        try {
            await action()
            const fresh = await read(id)

            if (!state.active || state.sequence !== sequence) {
                return false
            }

            state.fingerprint = JSON.stringify(fresh)
            state.pending = false

            setData(fresh)
            setChanged(false)

            return true
        } catch (cause) {
            if (!state.active || state.sequence !== sequence) {
                return false
            }

            if (cause instanceof SharedRankingUnavailableError) {
                state.fingerprint = ''
                setData(null)
                state.unavailable()
                setError(
                    'Diese Liste wurde gelöscht oder dein Zugriff wurde beendet.',
                )
            } else {
                state.blocked = true
                setNeedsReload(true)
                setError(
                    cause instanceof RevisionConflictError
                        ? 'Die Liste oder das Profil wurde inzwischen geändert. Bitte lade den aktuellen Stand.'
                        : 'Speichern konnte nicht bestätigt werden. Bitte lade den aktuellen Stand.',
                )
            }

            return false
        } finally {
            state.writing = false

            if (state.active) {
                setBusy(false)
                setEpoch((value) => value + 1)
                state.refresh()
            }
        }
    }

    function reload() {
        const state = runtime.current
        if (state.writing) return

        state.force = true
        state.blocked = true

        setLoading(true)
        setNeedsReload(true)
        state.refresh()
    }

    function onDragChange(dragging: boolean) {
        const state = runtime.current
        state.dragging = dragging

        if (!dragging) state.pump()
    }

    return {
        data,
        loading,
        busy,
        needsReload,
        changed,
        error,
        offline,
        epoch,
        blocked: loading || busy || needsReload,
        reload,
        perform,
        onDragChange,
    }
}