import {
    createContext,
    useContext,
    useEffect,
    useId,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/hooks/useAuth'
import { supabaseAuthService } from '../../infrastructure/supabase/supabaseAuthService'
import { supabaseChatRepository } from '../../infrastructure/supabase/supabaseChatRepository'
import { subscribeChatUpdates } from '../../infrastructure/supabase/subscribeListUpdates'
import { ListChatDialog } from './ListChatDialog'
import type { ChatTarget, ChatUnread } from './chat.types'
import { chatEnabled } from './chat.config'
import { reconcileDevicePush } from '../notifications/pushDevice'
import './ListChat.css'

const Unread = createContext<readonly ChatUnread[]>([])

export function ChatUnreadBadge({ kind, id }: ChatTarget) {
    const counts = useContext(Unread)

    const count = counts.find(
        (item) => item.kind === kind && item.id === id,
    )?.count ?? 0

    return count > 0 ? (
        <span
            className="chat-unread-badge"
            aria-label={count + ' ungelesene Nachrichten'}
            title={count + ' ungelesene Nachrichten'}
        >
            {count > 99 ? '99+' : count}
        </span>
    ) : null
}

function subscribePath(change: () => void) {
    const events = [
        'hashchange',
        'popstate',
        'delulu:navigate',
    ]

    for (const event of events) {
        window.addEventListener(event, change)
    }

    return () => {
        for (const event of events) {
            window.removeEventListener(event, change)
        }
    }
}

function readPath() {
    return window.location.hash.slice(1)
}

function ChatButton({
                        target,
                        userId,
                    }: {
    target: ChatTarget
    userId: string
}) {
    const [open, setOpen] = useState(() => {
        const params = new URLSearchParams(location.search)

        return (
            params.get('account') === userId &&
            params.get('chat') === target.kind + ':' + target.id
        )
    })

    useEffect(() => {
        const url = new URL(location.href)

        if (!url.searchParams.has('chat')) return

        url.searchParams.delete('chat')
        url.searchParams.delete('account')
        history.replaceState(history.state, '', url)
    }, [])

    const launch = useRef<HTMLButtonElement>(null)
    const panelId = useId()

    function close() {
        setOpen(false)

        requestAnimationFrame(() => {
            launch.current?.focus({ preventScroll: true })
        })
    }

    return (
        <>
            <button
                ref={launch}
                type="button"
                className="list-chat-launch"
                hidden={open}
                aria-label="Chat"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen(true)}
            >
                Chat <ChatUnreadBadge {...target} />
            </button>

            {open && (
                <ListChatDialog
                    panelId={panelId}
                    target={target}
                    repository={supabaseChatRepository}
                    subscribe={subscribeChatUpdates}
                    onClose={close}
                />
            )}
        </>
    )
}

function AccountChat({
                         userId,
                         children,
                     }: {
    userId: string
    children: ReactNode
}) {
    const [counts, setCounts] = useState<ChatUnread[]>([])
    const path = useSyncExternalStore(subscribePath, readPath)

    useEffect(() => {
        let active = true
        let reading = false
        let dirty = false

        let timer: ReturnType<typeof setTimeout> | undefined

        async function refresh() {
            if (!active) return

            if (reading) {
                dirty = true
                return
            }

            reading = true
            dirty = false

            try {
                const fresh = await supabaseChatRepository.unread()
                if (active) setCounts(fresh)
            } catch (cause) {
                if (active) {
                    console.warn(
                        '[deluLu] Chat badges unavailable:',
                        cause,
                    )
                }
            } finally {
                reading = false
                if (active && dirty) request()
            }
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

        const stop = subscribeChatUpdates(
            request,
            (connected) => {
                if (connected) request()
            },
        )

        window.addEventListener('focus', resume)
        window.addEventListener('online', resume)
        document.addEventListener('visibilitychange', resume)

        void refresh()

        return () => {
            active = false
            clearTimeout(timer)
            stop()

            window.removeEventListener('focus', resume)
            window.removeEventListener('online', resume)
            document.removeEventListener('visibilitychange', resume)
        }
    }, [userId])

    const match = path.match(
        /^\/(rankings|shared|tiers|shared-tiers)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    )

    const kind =
        match?.[1] === 'rankings' || match?.[1] === 'shared'
            ? 'ranking'
            : 'tier'

    return (
        <Unread.Provider value={counts}>
            {children}

            {match && (
                <ChatButton
                    userId={userId}
                    key={kind + ':' + match[2]}
                    target={{ kind, id: match[2] }}
                />
            )}
        </Unread.Provider>
    )
}

function DevelopmentChat({ children }: { children: ReactNode }) {
    const { user, isLoading } = useAuth(supabaseAuthService)

    useEffect(() => {
        if (!isLoading) {
            void reconcileDevicePush(user?.id ?? null)
                .catch(() => {
                    console.warn(
                        '[deluLu] Push device could not be synchronized',
                    )
                })
        }
    }, [isLoading, user?.id])

    return user ? (
        <AccountChat key={user.id} userId={user.id}>
            {children}
        </AccountChat>
    ) : (
        <>{children}</>
    )
}

export function DevListChat({ children }: { children: ReactNode }) {
    return chatEnabled ? (
        <DevelopmentChat>{children}</DevelopmentChat>
    ) : (
        <>{children}</>
    )
}