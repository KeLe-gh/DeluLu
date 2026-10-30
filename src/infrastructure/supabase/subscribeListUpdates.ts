import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './client'

type UpdateEvent = 'lists_changed' | 'chat_changed'

// Serialize disposal when routes change or React remounts an effect.
let disposal: Promise<unknown> = Promise.resolve()

function connectListUpdates(
    onChange: (event: UpdateEvent) => void,
    onConnection: (connected: boolean) => void,
): () => void {
    let active = true
    let channel: RealtimeChannel | null = null
    let retry: ReturnType<typeof setTimeout> | undefined

    async function start() {
        try {
            await disposal

            const { data, error } = await supabase.auth.getSession()

            if (error) throw error
            if (!active) return

            if (!data.session) {
                throw new Error('Authentication required.')
            }

            await supabase.realtime.setAuth()

            if (!active) return

            channel = supabase.channel(
                'delulu:user:' + data.session.user.id,
                {
                    config: { private: true },
                },
            )

            channel
                .on('broadcast', { event: 'lists_changed' }, () => {
                    if (active) onChange('lists_changed')
                })
                .on('broadcast', { event: 'chat_changed' }, () => {
                    if (active) onChange('chat_changed')
                })
                .subscribe((status) => {
                    if (!active) return

                    onConnection(status === 'SUBSCRIBED')

                    if (status === 'SUBSCRIBED') {
                        onChange('lists_changed')
                        onChange('chat_changed')
                    }
                })
        } catch (error) {
            if (!active) return

            onConnection(false)
            console.warn('[deluLu] Live connection failed:', error)
            retry = setTimeout(() => void start(), 5000)
        }
    }

    void start()

    return () => {
        active = false
        clearTimeout(retry)

        const previous = channel

        if (previous) {
            disposal = disposal
                .then(() => supabase.removeChannel(previous))
                .catch((error) => {
                    console.warn(
                        '[deluLu] Live disconnect failed:',
                        error,
                    )
                })
        }
    }
}

type Listener = {
    events: readonly UpdateEvent[]
    change: () => void
    connection: (connected: boolean) => void
}

const listeners = new Set<Listener>()

let disconnect: (() => void) | null = null
let connection: boolean | null = null

function subscribeUpdates(
    events: readonly UpdateEvent[],
    onChange: () => void,
    onConnection: (connected: boolean) => void,
): () => void {
    const listener = {
        events,
        change: onChange,
        connection: onConnection,
    }

    listeners.add(listener)

    if (connection !== null) {
        onConnection(connection)
    }

    if (!disconnect) {
        disconnect = connectListUpdates(
            (event) => {
                for (const item of listeners) {
                    if (item.events.includes(event)) {
                        item.change()
                    }
                }
            },
            (connected) => {
                connection = connected

                for (const item of listeners) {
                    item.connection(connected)
                }
            },
        )
    }

    return () => {
        listeners.delete(listener)

        if (listeners.size === 0) {
            disconnect?.()
            disconnect = null
            connection = null
        }
    }
}

export function subscribeListUpdates(
    onChange: () => void,
    onConnection: (connected: boolean) => void,
) {
    return subscribeUpdates(
        ['lists_changed'],
        onChange,
        onConnection,
    )
}

export function subscribeChatUpdates(
    onChange: () => void,
    onConnection: (connected: boolean) => void,
) {
    return subscribeUpdates(
        ['lists_changed', 'chat_changed'],
        onChange,
        onConnection,
    )
}