import { useLayoutEffect, useSyncExternalStore } from 'react'

const NAVIGATION_EVENT = 'delulu:navigate'

function readPath(): string {
    return window.location.hash.slice(1) || '/'
}

function subscribe(callback: () => void) {
    window.addEventListener('popstate', callback)
    window.addEventListener('hashchange', callback)
    window.addEventListener('pageshow', callback)
    window.addEventListener(NAVIGATION_EVENT, callback)

    return () => {
        window.removeEventListener('popstate', callback)
        window.removeEventListener('hashchange', callback)
        window.removeEventListener('pageshow', callback)
        window.removeEventListener(NAVIGATION_EVENT, callback)
    }
}

function navigate(path: string, replace = false) {
    const previousPath = readPath()

    if (path === previousPath) return

    const state = {
        ...window.history.state,
        deluluNavigation: {
            previousPath: replace ? null : previousPath,
        },
    }

    if (replace) {
        window.history.replaceState(state, '', '#' + path)
    } else {
        window.history.pushState(state, '', '#' + path)
    }

    window.dispatchEvent(new Event(NAVIGATION_EVENT))
}

function back(parentPath: string) {
    if (
        window.history.state?.deluluNavigation?.previousPath ===
        parentPath
    ) {
        window.history.back()
    } else {
        navigate(parentPath, true)
    }
}

export function useAppNavigation() {
    const path = useSyncExternalStore(subscribe, readPath)

    useLayoutEffect(() => {
        window.scrollTo(0, 0)
    }, [path])

    return { path, navigate, back }
}
