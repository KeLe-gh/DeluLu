type ListArgs = {
    p_kind: 'ranking' | 'tier'
    p_list_id: string
}

export type PushFunctions = {
    register_chat_push: {
        Args: {
            p_subscription: {
                endpoint: string
                keys: {
                    p256dh: string
                    auth: string
                }
            }
            p_origin: string
        }
        Returns: string
    }

    has_chat_push: {
        Args: { p_endpoint: string }
        Returns: boolean
    }

    unregister_chat_push: {
        Args: { p_endpoint: string }
        Returns: boolean
    }

    get_chat_push_muted: {
        Args: ListArgs
        Returns: boolean
    }

    set_chat_push_muted: {
        Args: ListArgs & { p_muted: boolean }
        Returns: boolean
    }
}