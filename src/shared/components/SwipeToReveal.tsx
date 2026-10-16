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
    onRemove: () => boolean | Promise<boolean>
    onRename?: () => void
    removeLabel?: string
    removeAriaLabel?: string
    removeError?: string
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
                                  onRename,
                                  removeLabel = 'Entfernen',
                                  removeAriaLabel = label + ' aus Liste entfernen',
                                  removeError = 'Der Eintrag konnte nicht entfernt werden.',
                              }: SwipeToRevealProps) {
    const actionsId = useId()
    const [offset, setOffset] = useState(0)
    const [swiping, setSwiping] = useState(false)
    const [error, setError] = useState('')
    const [isRemoving, setIsRemoving] = useState(false)

    const offsetRef = useRef(0)
    const gestureRef = useRef<Gesture | null>(null)
    const suppressClick = useRef(false)
    const removingRef = useRef(false)

    const actionsWidth = onRename
        ? ACTION_WIDTH * 2
        : ACTION_WIDTH

    const open = offset === -actionsWidth

    function updateOffset(value: number) {
        offsetRef.current = value
        setOffset(value)
    }

    async function remove() {
        if (removingRef.current) {
            return
        }

        removingRef.current = true
        setIsRemoving(true)
        setError('')

        try {
            if (!await onRemove()) {
                setError(removeError)
            }
        } catch {
            setError(removeError)
        } finally {
            removingRef.current = false
            setIsRemoving(false)
        }
    }

    function start(event: PointerEvent<HTMLDivElement>) {
        if (
            !event.isPrimary ||
            event.button !== 0 ||
            removingRef.current
        ) {
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

        if (!gesture || gesture.pointerId !== event.pointerId) {
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
            event.currentTarget.setPointerCapture(event.pointerId)
        }

        if (gesture.axis !== 'horizontal') {
            return
        }

        if (event.cancelable) {
            event.preventDefault()
        }

        updateOffset(
            Math.max(
                -actionsWidth,
                Math.min(0, gesture.startOffset + dx),
            ),
        )
    }

    function finish(event: PointerEvent<HTMLDivElement>) {
        const gesture = gestureRef.current

        if (!gesture || gesture.pointerId !== event.pointerId) {
            return
        }

        gestureRef.current = null
        setSwiping(false)

        if (gesture.axis === 'horizontal') {
            updateOffset(
                offsetRef.current <= -actionsWidth / 2
                    ? -actionsWidth
                    : 0,
            )
        }

        if (
            event.currentTarget.hasPointerCapture(event.pointerId)
        ) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
    }

    function cancel(event: PointerEvent<HTMLDivElement>) {
        const gesture = gestureRef.current

        if (!gesture || gesture.pointerId !== event.pointerId) {
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
                    style={{ width: actionsWidth }}
                    aria-hidden={!open}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault()
                            event.stopPropagation()
                            updateOffset(0)
                        }
                    }}
                >
                    {onRename && (
                        <button
                            type="button"
                            className="swipe-row__rename"
                            tabIndex={open ? 0 : -1}
                            aria-label={label + ' umbenennen'}
                            disabled={isRemoving}
                            onClick={() => {
                                updateOffset(0)
                                onRename()
                            }}
                        >
                            Umbenennen
                        </button>
                    )}

                    <button
                        type="button"
                        tabIndex={open ? 0 : -1}
                        aria-label={removeAriaLabel}
                        disabled={isRemoving}
                        onClick={() => {
                            void remove()
                        }}
                    >
                        {isRemoving ? 'Bitte warten …' : removeLabel}
                    </button>
                </div>

                <div
                    className="swipe-row__surface"
                    style={{
                        transform: `translateX(${offset}px)`,
                        transition: swiping ? 'none' : undefined,
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
                            target.closest('[data-drag-handle]')
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
                        disabled={isRemoving}
                        onClick={() =>
                            updateOffset(open ? 0 : -actionsWidth)
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