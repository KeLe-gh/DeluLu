export type ChatTarget = {
    kind: 'ranking' | 'tier'
    id: string
}

export type ChatMessage = {
    id: string
    sequence: string
    authorId: string | null
    authorName: string
    body: string
    createdAt: string
}

export type ChatSnapshot = {
    title: string
    viewerId: string
    displayName: string | null
    messages: ChatMessage[]
    hasMore: boolean
}

export type ChatUnread = ChatTarget & {
    count: number
}

export interface ChatRepository {
    read(
        target: ChatTarget,
        cursor?: { before?: string; from?: string },
    ): Promise<ChatSnapshot>

    unread(): Promise<ChatUnread[]>
    markRead(target: ChatTarget, through: string): Promise<void>
    remove(target: ChatTarget, id: string): Promise<void>
    setName(name: string): Promise<void>

    send(
        target: ChatTarget,
        id: string,
        body: string,
    ): Promise<void>
}

export class ChatUnavailableError extends Error {}