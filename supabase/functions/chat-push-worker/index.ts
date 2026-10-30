import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { createPushHandler } from './worker.ts'

const secretKeys = JSON.parse(
    Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}',
)

const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    secretKeys.default ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    },
)

Deno.serve(
    createPushHandler({
        rpc: (name, args) => admin.rpc(name, args),
        secret: Deno.env.get('PUSH_WORKER_SECRET') ?? '',
        publicKey: Deno.env.get('WEB_PUSH_PUBLIC_KEY') ?? '',
        privateKey: Deno.env.get('WEB_PUSH_PRIVATE_KEY') ?? '',
        subject: Deno.env.get('WEB_PUSH_SUBJECT') ?? '',
    }),
)