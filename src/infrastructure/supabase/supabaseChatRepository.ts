import {
    ChatUnavailableError,
    type ChatRepository,
} from '../../features/chat/chat.types'
import { supabase } from './client'

function checked<T>({
                        data,
                        error,
                    }: {
    data: T | null
    error: { code?: string } | null
}): T {
    if (error?.code === 'PT404') {
        throw new ChatUnavailableError()
    }

    if (error) throw error
    if (data === null) throw new Error('Missing chat response.')

    return data
}

export const supabaseChatRepository: ChatRepository = {
    async read(target, cursor) {
        return checked(
            await supabase.rpc('read_list_chat_page', {
                p_kind: target.kind,
                p_list_id: target.id,
                p_before: cursor?.before,
                p_from: cursor?.from,
            }),
        )
    },

    async unread() {
        return checked(
            await supabase.rpc('list_chat_unread', {}),
        )
    },

    async markRead(target, through) {
        checked(
            await supabase.rpc('mark_list_chat_read', {
                p_kind: target.kind,
                p_list_id: target.id,
                p_through: through,
            }),
        )
    },

    async remove(target, id) {
        checked(
            await supabase.rpc('delete_list_chat_message', {
                p_kind: target.kind,
                p_list_id: target.id,
                p_id: id,
            }),
        )
    },

    async setName(name) {
        checked(
            await supabase.rpc('set_list_chat_name', {
                p_name: name,
            }),
        )
    },

    async send(target, id, body) {
        checked(
            await supabase.rpc('send_list_chat_message', {
                p_kind: target.kind,
                p_list_id: target.id,
                p_id: id,
                p_body: body,
            }),
        )
    },
}