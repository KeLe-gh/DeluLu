import { useCallback, useEffect, useRef, useState } from 'react'
import {
    ChatUnavailableError,
    type ChatRepository,
    type ChatSnapshot,
    type ChatTarget,
} from './chat.types'

type Subscribe = (
    change: () => void,
    connection: (connected: boolean) => void,
) => () => void

const empty = async () => false

export function useListChat(
    target: ChatTarget,
    repository: ChatRepository,
    subscribe: Subscribe,
) {
    const [data, setData] = useState<ChatSnapshot | null>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [error, setError] = useState('')
    const [writeError, setWriteError] = useState('')
    const [offline, setOffline] = useState(false)
    const [unavailable, setUnavailable] = useState(false)

    const runtime = useRef<{
        reload: () => Promise<void>
        older: () => Promise<boolean>
        perform: (action: () => Promise<void>) => Promise<boolean>
        markRead: (through: string) => void
    }>({
        reload: async () => {},
        older: empty,
        perform: empty,
        markRead: () => {},
    })

    useEffect(() => {
        let active = true
        let writing = false
        let paging = false
        let dirty = false
        let version = 0

        let snapshot: ChatSnapshot | null = null
        let from: string | undefined
        let running: Promise<void> | null = null
        let timer: ReturnType<typeof setTimeout> | undefined

        let acknowledging = false
        let wanted = 0n
        let acknowledged = 0n

        const list = {
            kind: target.kind,
            id: target.id,
        }

        function failed(cause: unknown) {
            if (cause instanceof ChatUnavailableError) {
                snapshot = null
                setData(null)
                setUnavailable(true)
            } else {
                setError(
                    'Der Chat konnte nicht geladen werden. Bitte versuche es erneut.',
                )
            }
        }

        function commit(fresh: ChatSnapshot) {
            snapshot = fresh
            setData(fresh)
            setError('')
        }

        async function refresh(afterWrite = false) {
            if (!active) return

            if (running || paging || (writing && !afterWrite)) {
                dirty = true
                return
            }

            dirty = false
            const current = version

            running = (async () => {
                try {
                    const fresh = await repository.read(
                        list,
                        from ? { from } : undefined,
                    )

                    if (active && current === version) {
                        commit(fresh)
                    }
                } catch (cause) {
                    if (active && current === version) {
                        failed(cause)
                    }
                } finally {
                    if (active) setLoading(false)
                }
            })()

            await running
            running = null

            if (active && dirty) request()
        }

        function request() {
            clearTimeout(timer)
            timer = setTimeout(() => void refresh(), 180)
        }

        function resume() {
            if (document.visibilityState !== 'hidden') {
                request()
            }
        }

        async function older() {
            if (!active || writing || paging || !snapshot?.hasMore) {
                return false
            }

            paging = true
            setLoadingOlder(true)

            await running

            const before = snapshot?.messages[0]?.sequence ?? from

            if (!active || !snapshot || !before) {
                paging = false
                if (active) setLoadingOlder(false)
                return false
            }

            try {
                const previous = await repository.read(list, { before })

                if (!active) return false

                from = previous.messages[0]?.sequence ?? before

                const messages = [
                    ...previous.messages,
                    ...snapshot.messages,
                ]

                commit({
                    ...snapshot,
                    messages,
                    hasMore: previous.hasMore,
                })

                return true
            } catch (cause) {
                if (active) failed(cause)
                return false
            } finally {
                paging = false

                if (active) {
                    setLoadingOlder(false)
                    request()
                }
            }
        }

        async function perform(action: () => Promise<void>) {
            if (!active || writing || paging || !snapshot) {
                return false
            }

            writing = true
            version += 1
            setBusy(true)
            setWriteError('')

            let saved = false

            try {
                await running

                if (!active) return false

                await action()
                saved = true
            } catch (cause) {
                if (active) {
                    if (cause instanceof ChatUnavailableError) {
                        failed(cause)
                    } else {
                        setWriteError(
                            'Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.',
                        )
                    }
                }
            } finally {
                if (active) await refresh(true)

                writing = false
                if (active) setBusy(false)
            }

            return saved && active
        }

        function markRead(through: string) {
            wanted = BigInt(through) > wanted
                ? BigInt(through)
                : wanted

            if (acknowledging || acknowledged >= wanted || !active) {
                return
            }

            acknowledging = true

            void (async () => {
                try {
                    while (active && acknowledged < wanted) {
                        const next = wanted

                        await repository.markRead(
                            list,
                            next.toString(),
                        )

                        acknowledged = next
                    }
                } catch (cause) {
                    if (active && cause instanceof ChatUnavailableError) {
                        failed(cause)
                    } else if (active) {
                        console.warn(
                            '[deluLu] Chat read status will retry:',
                            cause,
                        )
                    }
                } finally {
                    acknowledging = false
                }
            })()
        }

        runtime.current = {
            reload: refresh,
            older,
            perform,
            markRead,
        }

        const stop = subscribe(request, (connected) => {
            if (active) setOffline(!connected)
        })

        window.addEventListener('focus', resume)
        window.addEventListener('online', resume)
        document.addEventListener('visibilitychange', resume)

        void refresh()

        return () => {
            active = false
            version += 1
            clearTimeout(timer)
            stop()

            window.removeEventListener('focus', resume)
            window.removeEventListener('online', resume)
            document.removeEventListener('visibilitychange', resume)
        }
    }, [target.kind, target.id, repository, subscribe])

    return {
        data,
        loading,
        busy,
        loadingOlder,
        error: writeError || error,
        offline,
        unavailable,

        perform: useCallback(
            (action: () => Promise<void>) =>
                runtime.current.perform(action),
            [],
        ),

        reload: useCallback(
            () => runtime.current.reload(),
            [],
        ),

        older: useCallback(
            () => runtime.current.older(),
            [],
        ),

        markRead: useCallback(
            (through: string) => runtime.current.markRead(through),
            [],
        ),
    }
}