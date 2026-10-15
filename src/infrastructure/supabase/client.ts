import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL

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

export const supabase = createClient(
    supabaseUrl,
    supabasePublishableKey,
)