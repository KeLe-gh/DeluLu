import { useEffect, useRef } from 'react'

export function useChatViewport() {
    const panel = useRef<HTMLElement>(null)

    useEffect(() => {
        const element = panel.current
        const viewport = window.visualViewport

        if (!element || !viewport) return

        function resize() {
            element!.style.setProperty(
                '--chat-height',
                viewport!.height + 'px',
            )

            element!.style.setProperty(
                '--chat-vtop',
                viewport!.offsetTop + 'px',
            )

            element!.dataset.compact = String(viewport!.height < 500)
        }

        resize()

        viewport.addEventListener('resize', resize)
        viewport.addEventListener('scroll', resize)

        return () => {
            viewport.removeEventListener('resize', resize)
            viewport.removeEventListener('scroll', resize)

            element.style.removeProperty('--chat-height')
            element.style.removeProperty('--chat-vtop')
            delete element.dataset.compact
        }
    }, [])

    return panel
}