import type { PushFunctions } from './pushDatabase.types'
import type {
    ChatSnapshot,
    ChatUnread,
} from '../../features/chat/chat.types'

type ListArgs = {
    p_kind: 'ranking' | 'tier'
    p_list_id: string
}

export type ChatFunctions = PushFunctions & {
    read_list_chat: {
        Args: ListArgs
        Returns: ChatSnapshot
    }

    read_list_chat_page: {
        Args: ListArgs & {
            p_before?: string
            p_from?: string
        }
        Returns: ChatSnapshot
    }

    list_chat_unread: {
        Args: Record<string, never>
        Returns: ChatUnread[]
    }

    mark_list_chat_read: {
        Args: ListArgs & { p_through: string }
        Returns: boolean
    }

    delete_list_chat_message: {
        Args: ListArgs & { p_id: string }
        Returns: boolean
    }

    set_list_chat_name: {
        Args: { p_name: string }
        Returns: string
    }

    send_list_chat_message: {
        Args: ListArgs & {
            p_id: string
            p_body: string
        }
        Returns: string
    }
}