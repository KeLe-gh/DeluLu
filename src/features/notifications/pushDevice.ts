import { supabase } from '../../infrastructure/supabase/client'
import { pushEnabled } from '../chat/chat.config'

const ownerKey = 'delulu.push.owner'

const publicKey =
    import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined

let work: Promise<unknown> = Promise.resolve()
let registration: Promise<ServiceWorkerRegistration> | undefined

function serial<T>(action: () => Promise<T>): Promise<T> {
    const result = work.then(action)
    work = result.catch(() => {})
    return result
}

function checked<T>({
                        data,
                        error,
                    }: {
    data: T | null
    error: unknown
}): T {
    if (error) throw error
    if (data === null) throw new Error('Missing push response')
    return data
}

export function needsHomeScreen() {
    const ios =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (
            navigator.platform === 'MacIntel' &&
            navigator.maxTouchPoints > 1
        )

    const standalone =
        matchMedia('(display-mode: standalone)').matches ||
        (
            navigator as Navigator & {
                standalone?: boolean
            }
        ).standalone

    return ios && !standalone
}

export function supportsPush() {
    return (
        isSecureContext &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    )
}

function registerWorker() {
    registration ??= navigator.serviceWorker
        .register('/delulu-push-sw.js', {
            scope: '/',
            updateViaCache: 'none',
        })
        .then(() => navigator.serviceWorker.ready)
        .catch((cause) => {
            registration = undefined
            throw cause
        })

    return registration
}

async function currentSubscription() {
    if (!supportsPush()) return null

    const worker =
        await navigator.serviceWorker.getRegistration('/')

    if (
        !worker ||
        new URL(
            worker.active?.scriptURL ?? location.href,
        ).pathname !== '/delulu-push-sw.js'
    ) {
        return null
    }

    return worker.pushManager.getSubscription()
}

async function save(subscription: PushSubscription) {
    const json = subscription.toJSON()

    if (
        !json.endpoint ||
        !json.keys?.p256dh ||
        !json.keys.auth
    ) {
        throw new Error('Invalid push subscription')
    }

    checked(
        await supabase.rpc('register_chat_push', {
            p_origin: location.origin,
            p_subscription: {
                endpoint: json.endpoint,
                keys: {
                    p256dh: json.keys.p256dh.replace(/=+$/, ''),
                    auth: json.keys.auth.replace(/=+$/, ''),
                },
            },
        }),
    )
}

async function disable() {
    const subscription = await currentSubscription()

    if (!subscription) {
        localStorage.removeItem(ownerKey)
        return
    }

    const results = await Promise.allSettled([
        subscription.unsubscribe().then((removed) => {
            if (!removed) {
                throw new Error('Push unsubscribe failed')
            }
        }),

        supabase
            .rpc('unregister_chat_push', {
                p_endpoint: subscription.endpoint,
            })
            .then((result) => {
                if (!checked(result)) {
                    throw new Error(
                        'Push device belongs to another account',
                    )
                }
            }),
    ])

    if (
        results.every(
            (result) => result.status === 'rejected',
        )
    ) {
        throw new Error('Push could not be disabled')
    }

    localStorage.removeItem(ownerKey)
    window.dispatchEvent(new Event('delulu:push-changed'))
}

export function disableDevicePush() {
    return serial(disable)
}

export function reconcileDevicePush(userId: string | null) {
    return serial(async () => {
        const owner = localStorage.getItem(ownerKey)

        if (
            owner &&
            (
                owner !== userId ||
                !pushEnabled ||
                !supportsPush() ||
                Notification.permission !== 'granted'
            )
        ) {
            await disable()
            return
        }

        if (
            !userId ||
            !pushEnabled ||
            !supportsPush() ||
            needsHomeScreen() ||
            !publicKey
        ) {
            return
        }

        await registerWorker()

        const subscription = await currentSubscription()

        if (owner === userId && subscription) {
            await save(subscription)
        }
    })
}

export function devicePushStatus(userId: string) {
    return serial(async () => {
        if (
            !supportsPush() ||
            Notification.permission !== 'granted'
        ) {
            return false
        }

        const subscription = await currentSubscription()

        if (
            !subscription ||
            localStorage.getItem(ownerKey) !== userId
        ) {
            return false
        }

        return checked(
            await supabase.rpc('has_chat_push', {
                p_endpoint: subscription.endpoint,
            }),
        )
    })
}

export function enableDevicePush(userId: string) {
    if (
        !pushEnabled ||
        !supportsPush() ||
        needsHomeScreen() ||
        !publicKey
    ) {
        return Promise.reject(
            new Error('Push is unavailable'),
        )
    }

    // Request permission directly from the button tap.
    const permission = Notification.requestPermission()

    return serial(async () => {
        if (await permission !== 'granted') {
            throw new Error(
                'Bitte erlaube Benachrichtigungen für deluLu.',
            )
        }

        const worker = await registerWorker()
        let subscription =
            await worker.pushManager.getSubscription()

        if (
            subscription &&
            localStorage.getItem(ownerKey) !== userId
        ) {
            if (!await subscription.unsubscribe()) {
                throw new Error('Push could not be reset')
            }

            subscription = null
        }

        const decoded = atob(
            publicKey
                .replaceAll('-', '+')
                .replaceAll('_', '/'),
        )

        const key = Uint8Array.from(
            decoded,
            (character) => character.charCodeAt(0),
        )

        subscription ??= await worker.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
        })

        await save(subscription)

        localStorage.setItem(ownerKey, userId)
        window.dispatchEvent(new Event('delulu:push-changed'))
    })
}