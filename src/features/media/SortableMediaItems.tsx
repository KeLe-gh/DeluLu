import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import {
    Accessibility,
    KeyboardSensor,
    PointerActivationConstraints,
    PointerSensor,
} from '@dnd-kit/dom'
import type { DragEndEvent } from '@dnd-kit/dom'
import {
    isSortable,
    useSortable,
} from '@dnd-kit/react/sortable'

const sensors = [
    PointerSensor.configure({
        activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 5 }),
        ],
    }),
    KeyboardSensor.configure({
        keyboardCodes: {
            start: ['Space'],
            cancel: ['Escape'],
            end: ['Space', 'Tab'],
            up: ['ArrowUp'],
            down: ['ArrowDown'],
            left: ['ArrowLeft'],
            right: ['ArrowRight'],
        },
    }),
]

function SortableRow<T extends { id: string }>({
                                                   item,
                                                   index,
                                                   render,
                                               }: {
    item: T
    index: number
    render: (
        item: T,
        index: number,
        handle: ReactNode,
    ) => ReactNode
}) {
    const { ref, handleRef, isDragging } = useSortable({
        id: item.id,
        index,
    })

    const handle = (
        <button
            ref={handleRef}
            type="button"
            className="media-drag"
            data-drag-handle
            data-swipe-ignore
            aria-label={'Position ' + (index + 1) + ' verschieben'}
            title="Zum Verschieben ziehen"
            onContextMenu={(event) => event.preventDefault()}
        >
            <span aria-hidden="true">⠿</span>
        </button>
    )

    return (
        <li
            ref={ref}
            className={
                isDragging ? 'media-item--dragging' : undefined
            }
        >
            {render(item, index, handle)}
        </li>
    )
}

export function SortableMediaItems<T extends { id: string }>({
                                                                 items,
                                                                 className,
                                                                 render,
                                                                 onReorder,
                                                             }: {
    items: readonly T[]
    className: string
    render: (
        item: T,
        index: number,
        handle: ReactNode,
    ) => ReactNode
    onReorder: (id: string, index: number) => Promise<boolean>
}) {
    const suppressUntil = useRef(0)
    const [error, setError] = useState('')
    const [reset, setReset] = useState(0)

    return (
        <>
            <DragDropProvider
                key={reset}
                sensors={sensors}
                plugins={(defaults) => [
                    ...defaults,
                    Accessibility.configure({
                        screenReaderInstructions: {
                            draggable:
                                'Griff mit Tab auswählen. ' +
                                'Leertaste zum Aufnehmen, ' +
                                'Pfeiltasten zum Verschieben, ' +
                                'Leertaste zum Ablegen, ' +
                                'Escape zum Abbrechen.',
                        },
                        announcements: {
                            dragstart: () => 'Eintrag aufgenommen.',
                            dragend: ({
                                          canceled,
                                      }: DragEndEvent) =>
                                canceled
                                    ? 'Verschieben abgebrochen.'
                                    : 'Verschieben beendet.',
                        },
                    }),
                ]}
                onDragStart={() => {
                    suppressUntil.current = Infinity
                    setError('')
                }}
                onDragEnd={async (event) => {
                    suppressUntil.current = Date.now() + 200

                    const source = event.operation.source

                    if (
                        event.canceled ||
                        !isSortable(source) ||
                        source.initialIndex === source.index
                    ) {
                        return
                    }

                    try {
                        const saved = await onReorder(
                            String(source.id),
                            source.index,
                        )

                        if (!saved) {
                            setReset((value) => value + 1)
                        }
                    } catch {
                        setError(
                            'Die Reihenfolge konnte nicht gespeichert werden.',
                        )
                        setReset((value) => value + 1)
                    }
                }}
            >
                <ol
                    className={className}
                    onClickCapture={(event) => {
                        if (Date.now() < suppressUntil.current) {
                            event.preventDefault()
                            event.stopPropagation()
                        }
                    }}
                >
                    {items.map((item, index) => (
                        <SortableRow
                            key={item.id}
                            item={item}
                            index={index}
                            render={render}
                        />
                    ))}
                </ol>
            </DragDropProvider>

            {error && <p role="alert">{error}</p>}
        </>
    )
}