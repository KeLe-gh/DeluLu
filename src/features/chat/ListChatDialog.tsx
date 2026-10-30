import {
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import type { ChatRepository, ChatTarget } from './chat.types'
import { useListChat } from './useListChat'
import { useChatViewport } from './useChatViewport'
import { ChatMuteButton } from '../notifications/ChatMuteButton'
import './ListChat.css'

type Subscribe = Parameters<typeof useListChat>[2]

const time = new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
})

export function ListChatDialog({
                                   target,
                                   repository,
                                   subscribe,
                                   onClose,
                                   panelId,
                               }: {
    target: ChatTarget
    repository: ChatRepository
    subscribe: Subscribe
    onClose: () => void
    panelId: string
}) {
    const chat = useListChat(target, repository, subscribe)
    const panel = useChatViewport()
    const history = useRef<HTMLOListElement>(null)
    const stick = useRef(true)

    const anchor = useRef<{
        height: number
        top: number
    } | null>(null)

    const titleId = useId()
    const inputId = useId()
    const nameId = useId()

    const [draft, setDraft] = useState('')
    const [name, setName] = useState('')
    const [changingName, setChangingName] = useState(false)
    const [validation, setValidation] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [atBottom, setAtBottom] = useState(true)

    const [foreground, setForeground] = useState(
        () =>
            document.visibilityState === 'visible' &&
            document.hasFocus(),
    )

    const pending = useRef<{
        id: string
        body: string
    } | null>(null)

    const working = chat.busy || chat.loadingOlder
    const latest = chat.data?.messages.at(-1)?.sequence
    const markRead = chat.markRead

    useEffect(() => {
        panel.current?.focus({ preventScroll: true })
    }, [panel])

    useEffect(() => {
        if (chat.unavailable) onClose()
    }, [chat.unavailable, onClose])

    useEffect(() => {
        function update() {
            setForeground(
                document.visibilityState === 'visible' &&
                document.hasFocus(),
            )
        }

        window.addEventListener('focus', update)
        window.addEventListener('blur', update)
        document.addEventListener('visibilitychange', update)

        return () => {
            window.removeEventListener('focus', update)
            window.removeEventListener('blur', update)
            document.removeEventListener('visibilitychange', update)
        }
    }, [])

    useEffect(() => {
        if (!foreground || !atBottom || !latest || working) {
            return
        }

        const timer = setTimeout(() => markRead(latest), 300)

        return () => clearTimeout(timer)
    }, [
        foreground,
        atBottom,
        latest,
        working,
        markRead,
        chat.data,
    ])

    useLayoutEffect(() => {
        const element = history.current
        if (!element) return

        if (anchor.current && !chat.loadingOlder) {
            element.scrollTop =
                element.scrollHeight -
                anchor.current.height +
                anchor.current.top

            anchor.current = null
        } else if (stick.current) {
            element.scrollTop = element.scrollHeight
        }
    }, [chat.data, chat.loadingOlder])

    async function older() {
        if (!history.current || working) return

        anchor.current = {
            height: history.current.scrollHeight,
            top: history.current.scrollTop,
        }

        stick.current = false
        setAtBottom(false)

        if (!await chat.older()) {
            anchor.current = null
        }
    }

    async function saveName() {
        const value = name.trim()

        if (
            !value ||
            value.length > 40 ||
            [...value].some((character) => {
                const code = character.charCodeAt(0)
                return code < 32 || code === 127
            })
        ) {
            setValidation(
                'Bitte gib einen Namen mit 1 bis 40 Zeichen ein.',
            )
            return
        }

        setValidation('')

        if (await chat.perform(() => repository.setName(value))) {
            setChangingName(false)
        }
    }

    async function send() {
        const body = draft.trim()

        if (!body || body.length > 2000) return

        if (pending.current?.body !== body) {
            pending.current = {
                id: crypto.randomUUID(),
                body,
            }
        }

        const message = pending.current

        stick.current = true
        setAtBottom(true)

        if (
            await chat.perform(() =>
                repository.send(target, message.id, message.body),
            )
        ) {
            setDraft('')
            pending.current = null
        }
    }

    async function remove(id: string) {
        if (await chat.perform(() => repository.remove(target, id))) {
            setDeleting(null)
        }
    }

    return (
        <aside
            ref={panel}
            id={panelId}
            tabIndex={-1}
            className="list-chat-sidebar"
            aria-labelledby={titleId}
            aria-busy={working}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && !working) {
                    event.stopPropagation()

                    if (deleting) {
                        setDeleting(null)
                    } else {
                        onClose()
                    }
                }
            }}
        >
            <header className="list-chat-header">
                <div>
                    <h2 id={titleId}>Chat</h2>
                    <p>{chat.data?.title}</p>
                </div>

                <button
                    type="button"
                    disabled={working}
                    onClick={onClose}
                >
                    Schliessen
                </button>
            </header>

            {chat.loading && (
                <p role="status">Chat wird geladen …</p>
            )}

            {chat.offline && (
                <p className="field-hint">
                    Live-Verbindung unterbrochen.
                </p>
            )}

            {chat.error && <p role="alert">{chat.error}</p>}

            {chat.data && (
                <>
                    {chat.data.hasMore && (
                        <button
                            className="list-chat-older"
                            type="button"
                            disabled={working}
                            onClick={() => void older()}
                        >
                            {chat.loadingOlder
                                ? 'Wird geladen …'
                                : 'Ältere Nachrichten laden'}
                        </button>
                    )}

                    <ol
                        ref={history}
                        className="list-chat-history"
                        aria-label="Nachrichten"
                        role="log"
                        onScroll={() => {
                            const element = history.current

                            if (element) {
                                stick.current =
                                    element.scrollHeight -
                                    element.scrollTop -
                                    element.clientHeight <
                                    48

                                setAtBottom(stick.current)
                            }
                        }}
                    >
                        {chat.data.messages.map((message) => (
                            <li
                                key={message.id}
                                className={
                                    'list-chat-message' +
                                    (
                                        message.authorId ===
                                        chat.data?.viewerId
                                            ? ' list-chat-message--own'
                                            : ''
                                    )
                                }
                            >
                                <div className="list-chat-message-heading">
                                    <strong>{message.authorName}</strong>

                                    {message.authorId ===
                                        chat.data?.viewerId && (
                                            <button
                                                type="button"
                                                className="list-chat-delete"
                                                aria-label="Nachricht löschen"
                                                disabled={working}
                                                onClick={() =>
                                                    setDeleting(message.id)
                                                }
                                            >
                                                ⋯
                                            </button>
                                        )}
                                </div>

                                <p>{message.body}</p>

                                <time dateTime={message.createdAt}>
                                    {time.format(
                                        new Date(message.createdAt),
                                    )}
                                </time>

                                {deleting === message.id && (
                                    <div className="list-chat-delete-confirm">
                                        <p>Nachricht für alle löschen?</p>

                                        <button
                                            type="button"
                                            disabled={working}
                                            onClick={() =>
                                                void remove(message.id)
                                            }
                                        >
                                            Löschen
                                        </button>

                                        <button
                                            type="button"
                                            disabled={working}
                                            onClick={() =>
                                                setDeleting(null)
                                            }
                                        >
                                            Abbrechen
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}

                        {!chat.data.messages.length && (
                            <li className="field-hint">
                                Noch keine Nachrichten.
                            </li>
                        )}
                    </ol>

                    {!atBottom && (
                        <button
                            className="list-chat-latest"
                            type="button"
                            onClick={() => {
                                stick.current = true
                                setAtBottom(true)

                                history.current?.scrollTo({
                                    top: history.current.scrollHeight,
                                })
                            }}
                        >
                            Zu den neuesten Nachrichten ↓
                        </button>
                    )}

                    <fieldset
                        className="list-chat-controls"
                        disabled={working}
                    >
                        {!chat.data.displayName || changingName ? (
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    void saveName()
                                }}
                            >
                                <div>
                                    <label htmlFor={nameId}>
                                        Dein Name im Chat
                                    </label>

                                    <input
                                        id={nameId}
                                        autoComplete="nickname"
                                        maxLength={40}
                                        required
                                        value={name}
                                        onChange={(event) => {
                                            setName(event.target.value)
                                            setValidation('')
                                        }}
                                    />
                                </div>

                                {validation && (
                                    <p role="alert">{validation}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={!name.trim()}
                                >
                                    Name speichern
                                </button>

                                {changingName && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setChangingName(false)
                                        }
                                    >
                                        Abbrechen
                                    </button>
                                )}
                            </form>
                        ) : (
                            <form
                                className="list-chat-composer"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    void send()
                                }}
                            >
                                <label
                                    htmlFor={inputId}
                                    className="sr-only"
                                >
                                    Nachricht
                                </label>

                                <textarea
                                    id={inputId}
                                    rows={2}
                                    maxLength={2000}
                                    placeholder="Nachricht …"
                                    required
                                    value={draft}
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                />

                                <button
                                    type="submit"
                                    disabled={!draft.trim()}
                                >
                                    Senden
                                </button>
                            </form>
                        )}

                        <div className="list-chat-tools">
                            <ChatMuteButton target={target} />

                            {chat.data.displayName && !changingName && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setName(
                                            chat.data?.displayName ?? '',
                                        )
                                        setChangingName(true)
                                    }}
                                >
                                    Name ändern
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => void chat.reload()}
                            >
                                Aktualisieren
                            </button>
                        </div>
                    </fieldset>
                </>
            )}

            {!chat.data && !chat.loading && (
                <button
                    type="button"
                    onClick={() => void chat.reload()}
                >
                    Erneut versuchen
                </button>
            )}
        </aside>
    )
}