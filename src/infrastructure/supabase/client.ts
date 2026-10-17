import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppDatabase } from './appDatabase.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

const supabasePublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
        'Die Supabase-Konfiguration fehlt. Prüfe deine .env.local.',
    )
}

if (!supabasePublishableKey.startsWith('sb_publishable_')) {
    throw new Error(
        'Bitte verwende den Supabase-Publishable-Key.',
    )
}

interface CachedSupabaseClient {
    url: string
    publishableKey: string
    client: SupabaseClient<AppDatabase>
}

const developmentRuntime = globalThis as typeof globalThis & {
    __deluluSupabaseClient?: CachedSupabaseClient
}

function getSupabaseClient(): SupabaseClient<AppDatabase> {
    const cached = developmentRuntime.__deluluSupabaseClient

    if (
        import.meta.env.DEV &&
        cached &&
        cached.url === supabaseUrl &&
        cached.publishableKey === supabasePublishableKey
    ) {
        return cached.client
    }

    const client = createClient<AppDatabase>(
        supabaseUrl,
        supabasePublishableKey,
    )

    if (import.meta.env.DEV) {
        developmentRuntime.__deluluSupabaseClient = {
            url: supabaseUrl,
            publishableKey: supabasePublishableKey,
            client,
        }
    }

    return client
}

export const supabase = getSupabaseClient()