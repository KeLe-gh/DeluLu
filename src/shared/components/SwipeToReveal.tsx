import { useId, useRef, useState } from 'react'
import type {
    MouseEvent,
    PointerEvent,
    ReactNode,
} from 'react'
import './SwipeToReveal.css'

interface SwipeToRevealProps {
    children: ReactNode
    label: string
    onRemove: () => boolean
}

interface Gesture {
    pointerId: number
    startX: number
    startY: number
    startOffset: number
    axis: 'pending' | 'horizontal' | 'vertical'
}

const ACTION_WIDTH = 96
const INTENT_DISTANCE = 8

export function SwipeToReveal({
                                  children,
                                  label,
                                  onRemove,
                              }: SwipeToRevealProps) {
    const actionsId = useId()

    const [offset, setOffset] = useState(0)
    const [swiping, setSwiping] = useState(false)
    const [error, setError] = useState('')

    const offsetRef = useRef(0)
    const gestureRef = useRef<Gesture | null>(null)
    const suppressClick = useRef(false)

    const open = offset === -ACTION_WIDTH

    function updateOffset(value: number) {
        offsetRef.current = value
        setOffset(value)
    }

    function start(event: PointerEvent<HTMLDivElement>) {
        if (!event.isPrimary || event.button !== 0) {
            return
        }

        suppressClick.current = false

        const target = event.target

        if (target instanceof Element) {
            if (target.closest('[data-drag-handle]')) {
                updateOffset(0)
                return
            }

            if (target.closest('[data-swipe-ignore]')) {
                return
            }
        }

        gestureRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startOffset: offsetRef.current,
            axis: 'pending',
        }
    }

    function move(event: PointerEvent<HTMLDivElement>) {
        const gesture = gestureRef.current

        if (
            !gesture ||
            gesture.pointerId !== event.pointerId
        ) {
            return
        }

        const dx = event.clientX - gesture.startX
        const dy = event.clientY - gesture.startY

        if (gesture.axis === 'pending') {
            if (
                Math.max(Math.abs(dx), Math.abs(dy)) <
                INTENT_DISTANCE
            ) {
                return
            }

            suppressClick.current = true

            if (Math.abs(dy) >= Math.abs(dx)) {
                gesture.axis = 'vertical'
                return
            }

            gesture.axis = 'horizontal'
            setSwiping(true)

            event.currentTarget.setPointerCapture(
                event.pointerId,
            )
        }

        if (gesture.axis !== 'horizontal') {
            return
        }

        if (event.cancelable) {
            event.preventDefault()
        }

        updateOffset(
            Math.max(
                -ACTION_WIDTH,
                Math.min(0, gesture.startOffset + dx),
            ),
        )
    }

    function finish(event: PointerEvent<HTMLDivElement>) {
        const gesture = gestureRef.current

        if (
            !gesture ||
            gesture.pointerId !== event.pointerId
        ) {
            return
        }

        gestureRef.current = null
        setSwiping(false)

        if (gesture.axis === 'horizontal') {
            updateOffset(
                offsetRef.current <= -ACTION_WIDTH / 2
                    ? -ACTION_WIDTH
                    : 0,
            )
        }

        if (
            event.currentTarget.hasPointerCapture(
                event.pointerId,
            )
        ) {
            event.currentTarget.releasePointerCapture(
                event.pointerId,
            )
        }
    }

    function cancel(event: PointerEvent<HTMLDivElement>) {
        const gesture = gestureRef.current

        if (
            !gesture ||
            gesture.pointerId !== event.pointerId
        ) {
            return
        }

        gestureRef.current = null
        setSwiping(false)
        updateOffset(gesture.startOffset)
    }

    function handleClick(event: MouseEvent<HTMLDivElement>) {
        const target = event.target

        if (
            target instanceof Element &&
            target.closest(
                '[data-swipe-ignore], [data-drag-handle]',
            )
        ) {
            return
        }

        if (event.detail === 0) {
            return
        }

        if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressClick.current = false
            return
        }

        if (offsetRef.current < 0) {
            event.preventDefault()
            event.stopPropagation()
            updateOffset(0)
        }
    }

    return (
        <>
            <div className="swipe-row">
                <div
                    id={actionsId}
                    className="swipe-row__actions"
                    aria-hidden={!open}
                >
                    <button
                        type="button"
                        tabIndex={open ? 0 : -1}
                        aria-label={
                            label + ' aus Liste entfernen'
                        }
                        onClick={() => {
                            if (!onRemove()) {
                                setError(
                                    'Der Eintrag konnte nicht entfernt werden.',
                                )
                            }
                        }}
                    >
                        Entfernen
                    </button>
                </div>

                <div
                    className="swipe-row__surface"
                    style={{
                        transform:
                            'translateX(' + offset + 'px)',
                        transition: swiping
                            ? 'none'
                            : undefined,
                    }}
                    onPointerDown={start}
                    onPointerMove={move}
                    onPointerUp={finish}
                    onPointerCancel={cancel}
                    onLostPointerCapture={cancel}
                    onClickCapture={handleClick}
                    onKeyDown={(event) => {
                        const target = event.target

                        if (
                            target instanceof Element &&
                            target.closest(
                                '[data-drag-handle]',
                            )
                        ) {
                            return
                        }

                        if (
                            event.key === 'Escape' &&
                            offsetRef.current < 0
                        ) {
                            event.preventDefault()
                            event.stopPropagation()
                            updateOffset(0)
                        }
                    }}
                >
                    {children}

                    <button
                        type="button"
                        className="swipe-row__toggle"
                        data-swipe-ignore
                        aria-label={'Aktionen für ' + label}
                        aria-expanded={open}
                        aria-controls={actionsId}
                        onClick={() =>
                            updateOffset(
                                open ? 0 : -ACTION_WIDTH,
                            )
                        }
                    >
                        <span aria-hidden="true">⋯</span>
                    </button>
                </div>
            </div>

            {error && <p role="alert">{error}</p>}
        </>
    )
}