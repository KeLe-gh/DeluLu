/* Push only: no page or asset caching. */

const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function target(value) {
    return (
        value &&
        uuid.test(value.userId) &&
        uuid.test(value.listId) &&
        ['ranking', 'tier'].includes(value.kind)
    )
        ? {
            userId: value.userId,
            listId: value.listId,
            kind: value.kind,
        }
        : null
}

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
    let data = null

    try {
        data = target(event.data?.json())
    } catch {
        // Show the generic fallback notification.
    }

    event.waitUntil(
        self.registration.showNotification('deluLu 💜', {
            body: 'Neue Nachricht in einer geteilten Liste.',
            icon: '/icons/penguin-192.png',
            tag: data
                ? 'delulu-chat:' +
                data.userId + ':' +
                data.kind + ':' +
                data.listId
                : 'delulu-chat',
            data,
        }),
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const data = target(event.notification.data)
    const url = new URL('/', self.location.origin)

    url.hash = '/'

    if (data) {
        url.hash =
            (
                data.kind === 'tier'
                    ? '/shared-tiers/'
                    : '/shared/'
            ) + data.listId

        url.searchParams.set(
            'chat',
            data.kind + ':' + data.listId,
        )

        url.searchParams.set('account', data.userId)
    }

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            })

            const existing = windows.find(
                (client) =>
                    new URL(client.url).origin ===
                    self.location.origin,
            )

            if (existing) {
                try {
                    const navigated =
                        await existing.navigate(url.href)

                    if (navigated) {
                        await navigated.focus()
                        return
                    }
                } catch {
                    // The old window may have closed.
                }
            }

            await self.clients.openWindow(url.href)
        })(),
    )
})