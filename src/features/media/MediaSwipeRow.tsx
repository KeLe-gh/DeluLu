import { useId, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'

export interface MediaAction {
    label: string
    run: () => void
}

interface Gesture {
    id: number
    x: number
    y: number
    start: number
    offset: number
    axis: 'pending' | 'horizontal' | 'vertical'
}

export function MediaSwipeRow({
                                  name,
                                  children,
                                  actions,
                              }: {
    name: string
    children: ReactNode
    actions: MediaAction[]
}) {
    const id = useId()
    const [open, setOpen] = useState(false)
    const [offset, setOffset] = useState<number | null>(null)

    const suppress = useRef(false)
    const gesture = useRef<Gesture | null>(null)
    const width = actions.length * 80

    function finish(
        event: PointerEvent<HTMLDivElement>,
        cancelled = false,
    ) {
        const current = gesture.current

        if (!current || current.id !== event.pointerId) return

        gesture.current = null

        if (!cancelled && current.axis === 'horizontal') {
            const distance = current.offset - current.start

            if (distance <= -24) {
                setOpen(true)
            } else if (distance >= 24) {
                setOpen(false)
            }
        }

        setOffset(null)

        if (
            event.currentTarget.hasPointerCapture(event.pointerId)
        ) {
            event.currentTarget.releasePointerCapture(
                event.pointerId,
            )
        }
    }

    return (
        <div
            className="media-swipe"
            onKeyDown={(event) => {
                if (event.key === 'Escape' && open) {
                    event.preventDefault()
                    event.stopPropagation()
                    setOpen(false)
                }
            }}
        >
            <div
                id={id}
                className="media-swipe__actions"
                style={{ width }}
                aria-hidden={!open}
                inert={!open}
            >
                {actions.map((action) => (
                    <button
                        key={action.label}
                        type="button"
                        aria-label={name + ': ' + action.label}
                        onClick={() => {
                            setOpen(false)
                            action.run()
                        }}
                    >
                        {action.label}
                    </button>
                ))}
            </div>

            <div
                className="media-swipe__surface"
                style={{
                    transform: `translateX(${offset ?? (open ? -width : 0)}px)`,
                    transition:
                        offset !== null ? 'none' : undefined,
                }}
                onPointerDown={(event) => {
                    if (!event.isPrimary || event.button !== 0) {
                        return
                    }

                    suppress.current = false

                    if (
                        (event.target as Element).closest(
                            '[data-swipe-ignore]',
                        )
                    ) {
                        return
                    }

                    gesture.current = {
                        id: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        start: open ? -width : 0,
                        offset: open ? -width : 0,
                        axis: 'pending',
                    }
                }}
                onPointerMove={(event) => {
                    const current = gesture.current

                    if (
                        !current ||
                        current.id !== event.pointerId
                    ) {
                        return
                    }

                    const dx = event.clientX - current.x
                    const dy = event.clientY - current.y

                    if (current.axis === 'pending') {
                        if (
                            Math.max(Math.abs(dx), Math.abs(dy)) < 8
                        ) {
                            return
                        }

                        suppress.current = true

                        current.axis = Math.abs(dx) > Math.abs(dy)
                            ? 'horizontal'
                            : 'vertical'

                        if (current.axis === 'horizontal') {
                            event.currentTarget.setPointerCapture(
                                event.pointerId,
                            )
                        }
                    }

                    if (current.axis !== 'horizontal') return

                    if (event.cancelable) {
                        event.preventDefault()
                    }

                    current.offset = Math.max(
                        -width,
                        Math.min(0, current.start + dx),
                    )

                    setOffset(current.offset)
                }}
                onPointerUp={(event) => finish(event)}
                onPointerCancel={(event) =>
                    finish(event, true)
                }
                onLostPointerCapture={(event) => {
                    if (event.target === event.currentTarget) {
                        finish(event, true)
                    }
                }}
                onClickCapture={(event) => {
                    if (
                        (event.target as Element).closest(
                            '[data-swipe-ignore]',
                        ) ||
                        event.detail === 0
                    ) {
                        return
                    }

                    if (suppress.current) {
                        event.preventDefault()
                        event.stopPropagation()
                        suppress.current = false
                        return
                    }

                    if (open) {
                        event.preventDefault()
                        event.stopPropagation()
                        setOpen(false)
                    }
                }}
            >
                {children}

                <button
                    type="button"
                    className="media-swipe__toggle"
                    data-swipe-ignore
                    aria-label={'Aktionen für ' + name}
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => setOpen(!open)}
                >
                    ⋯
                </button>
            </div>
        </div>
    )
}