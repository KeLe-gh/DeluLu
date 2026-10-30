import { buildPushPayload } from 'npm:@block65/webcrypto-web-push@2.0.0'

type Rpc = (
    name: string,
    args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>

type Lease = {
    id: string
    token: string
}

type Delivery = {
    endpoint: string
    keys: { p256dh: string; auth: string }
    origin: string
    userId: string
    kind: 'ranking' | 'tier'
    listId: string
}

type Config = {
    rpc: Rpc
    secret: string
    publicKey: string
    privateKey: string
    subject: string
    fetch?: typeof fetch
    sleep?: (milliseconds: number) => Promise<void>
}

const hosts = new Set([
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
    'web.push.apple.com',
])

export function createPushHandler(config: Config) {
    const send = config.fetch ?? fetch

    const sleep = config.sleep ?? (
        (milliseconds) =>
            new Promise((resolve) => setTimeout(resolve, milliseconds))
    )

    async function rpc<T>(
        name: string,
        args?: Record<string, unknown>,
    ): Promise<T> {
        const result = await config.rpc(name, args)

        if (result.error) {
            throw new Error('Push database operation failed')
        }

        return result.data as T
    }

    async function equalSecret(actual: string) {
        const encode = new TextEncoder()

        const a = new Uint8Array(
            await crypto.subtle.digest(
                'SHA-256',
                encode.encode(actual),
            ),
        )

        const b = new Uint8Array(
            await crypto.subtle.digest(
                'SHA-256',
                encode.encode(config.secret),
            ),
        )

        let difference = 0

        for (let i = 0; i < a.length; i++) {
            difference |= a[i] ^ b[i]
        }

        return difference === 0
    }

    async function deliver(lease: Lease) {
        let status = 0
        let retryAfter: number | null = null

        try {
            const job = await rpc<Delivery | null>(
                'prepare_chat_push_job',
                {
                    p_id: lease.id,
                    p_token: lease.token,
                },
            )

            if (!job) return

            const endpoint = new URL(job.endpoint)

            if (
                endpoint.protocol !== 'https:' ||
                endpoint.port ||
                endpoint.username ||
                endpoint.password ||
                !hosts.has(endpoint.hostname)
            ) {
                throw new Error('Invalid push endpoint')
            }

            const data = {
                userId: job.userId,
                kind: job.kind,
                listId: job.listId,
            }

            const digest = new Uint8Array(
                await crypto.subtle.digest(
                    'SHA-256',
                    new TextEncoder().encode(JSON.stringify(data)),
                ),
            )

            const topic = btoa(String.fromCharCode(...digest))
                .replaceAll('+', '-')
                .replaceAll('/', '_')
                .slice(0, 32)

            const payload = await buildPushPayload(
                {
                    data,
                    options: {
                        ttl: 3600,
                        topic,
                        urgency: 'normal',
                    },
                },
                {
                    endpoint: job.endpoint,
                    expirationTime: null,
                    keys: job.keys,
                },
                {
                    subject: config.subject,
                    publicKey: config.publicKey,
                    privateKey: config.privateKey,
                },
            )

            const response = await send(job.endpoint, {
                ...payload,
                redirect: 'error',
                signal: AbortSignal.timeout(8000),
            })

            status = response.status

            if (status < 200 || status >= 300) {
                console.warn(
                    '[deluLu] Push provider status',
                    status,
                    'for job',
                    lease.id,
                )
            }

            const retry = response.headers.get('retry-after')

            if (retry && /^\d+$/.test(retry)) {
                retryAfter = Math.min(3600, Number(retry))
            }

            await response.body?.cancel()
        } catch {
            console.warn(
                '[deluLu] Push attempt failed for job',
                lease.id,
            )
        }

        try {
            await rpc('finish_chat_push_job', {
                p_id: lease.id,
                p_token: lease.token,
                p_status: status,
                p_retry_after: retryAfter,
            })
        } catch {
            console.warn(
                '[deluLu] Push result could not be saved for job',
                lease.id,
            )
        }
    }

    return async (request: Request) => {
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 })
        }

        if (
            !config.secret ||
            !config.publicKey ||
            !config.privateKey ||
            !config.subject
        ) {
            return new Response(
                'Push worker not configured',
                { status: 503 },
            )
        }

        if (
            !await equalSecret(
                request.headers.get('x-push-secret') ?? '',
            )
        ) {
            return new Response('Unauthorized', { status: 401 })
        }

        try {
            // An open chat gets time to acknowledge the message.
            await sleep(2200)

            const jobs = await rpc<Lease[]>('claim_chat_push_jobs')
            let next = 0

            await Promise.all(
                Array.from(
                    { length: Math.min(4, jobs.length) },
                    async () => {
                        while (next < jobs.length) {
                            await deliver(jobs[next++])
                        }
                    },
                ),
            )

            return Response.json({ processed: jobs.length })
        } catch {
            console.warn(
                '[deluLu] Push queue could not be read; check the SQL migration and server configuration',
            )

            return new Response(
                'Push worker failed',
                { status: 500 },
            )
        }
    }
}