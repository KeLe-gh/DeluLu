import { useRef, useState } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import {
    Accessibility,
    KeyboardSensor,
    PointerActivationConstraints,
    PointerSensor,
} from '@dnd-kit/dom'
import type {
    DragEndEvent,
    DragOverEvent,
} from '@dnd-kit/dom'
import {
    isSortable,
    useSortable,
} from '@dnd-kit/react/sortable'
import type {
    ListId,
    RankingList,
} from '../../../shared/types/list.types'
import { SwipeToReveal } from '../../../shared/components/SwipeToReveal'
import { getRankingSize } from '../model/ranking.operations'
import './RankingEntries.css'
import './RankingLists.css'

const listSensors = [
    PointerSensor.configure({
        activationConstraints(event: PointerEvent) {
            if (event.pointerType === 'touch') {
                return [
                    new PointerActivationConstraints.Delay({
                        value: 300,
                        tolerance: 6,
                    }),
                ]
            }

            return [
                new PointerActivationConstraints.Distance({
                    value: 8,
                    tolerance: { x: 6 },
                }),
            ]
        },
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

interface SortableRankingListsProps {
    lists: readonly RankingList[]
    onOpen: (listId: ListId) => void
    onRename: (listId: ListId) => void
    onDelete: (listId: ListId) => Promise<boolean>
    onReorder: (
        listId: ListId,
        toIndex: number,
    ) => Promise<boolean>
}

interface SortableListProps {
    list: RankingList
    index: number
    onOpen: () => void
    onRename: () => void
    onDelete: () => Promise<boolean>
}

function SortableList({
                          list,
                          index,
                          onOpen,
                          onRename,
                          onDelete,
                      }: SortableListProps) {
    const { ref, handleRef, isDragging } = useSortable({
        id: list.id,
        index,
        data: { name: list.title },
    })

    const size = getRankingSize(list)

    return (
        <li
            ref={ref}
            className={
                'ranking-entry' +
                (isDragging ? ' ranking-entry--dragging' : '')
            }
        >
            <SwipeToReveal
                label={list.title}
                onRemove={onDelete}
                onRename={onRename}
                removeLabel="Löschen"
                removeAriaLabel={`Liste ${list.title} löschen`}
                removeError="Die Liste konnte nicht gelöscht werden."
            >
                <button
                    ref={handleRef}
                    type="button"
                    className="ranking-entry__edit"
                    onClick={onOpen}
                    onContextMenu={(event) =>
                        event.preventDefault()
                    }
                    aria-label={
                        list.title +
                        ', öffnen, halten zum Verschieben'
                    }
                >
                    <span className="ranking-entry__name">
                        <strong className="ranking-card__title">
                            {list.title}
                        </strong>

                        <span className="ranking-list__subtitle">
                            {size === 0
                                ? 'Leere Rangliste'
                                : `Top ${size}`}
                        </span>
                    </span>

                    <span
                        className="ranking-entry__grip"
                        aria-hidden="true"
                    >
                        ⠿
                    </span>
                </button>
            </SwipeToReveal>
        </li>
    )
}

export function SortableRankingLists({
                                         lists,
                                         onOpen,
                                         onRename,
                                         onDelete,
                                         onReorder,
                                     }: SortableRankingListsProps) {
    const [error, setError] = useState('')
    const suppressOpenUntil = useRef(0)

    return (
        <>
            <p>
                Tippen zum Öffnen. Zum Sortieren kurz halten
                und ziehen. Nach links wischen für
                Umbenennen und Löschen.
            </p>

            <DragDropProvider
                sensors={listSensors}
                plugins={(defaults) => [
                    ...defaults,
                    Accessibility.configure({
                        screenReaderInstructions: {
                            draggable:
                                'Enter zum Öffnen. ' +
                                'Leertaste zum Aufnehmen. ' +
                                'Mit den Pfeiltasten verschieben. ' +
                                'Leertaste zum Ablegen. ' +
                                'Escape zum Abbrechen.',
                        },
                        announcements: {
                            dragstart: () =>
                                'Liste aufgenommen.',

                            dragover: ({
                                           operation: { source },
                                       }: DragOverEvent) =>
                                isSortable(source)
                                    ? `Zielposition ${source.index + 1}.`
                                    : undefined,

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
                    suppressOpenUntil.current =
                        Number.POSITIVE_INFINITY
                    setError('')
                }}
                onDragEnd={async (event) => {
                    suppressOpenUntil.current =
                        Date.now() + 200

                    if (event.canceled) {
                        return
                    }

                    const { source } = event.operation

                    if (
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
                            setError(
                                'Die Listenreihenfolge konnte nicht gespeichert werden.',
                            )
                        }
                    } catch {
                        setError(
                            'Die Listenreihenfolge konnte nicht gespeichert werden.',
                        )
                    }
                }}
            >
                <ul className="ranking-entries">
                    {lists.map((list, index) => (
                        <SortableList
                            key={list.id}
                            list={list}
                            index={index}
                            onOpen={() => {
                                if (
                                    Date.now() >=
                                    suppressOpenUntil.current
                                ) {
                                    onOpen(list.id)
                                }
                            }}
                            onRename={() => onRename(list.id)}
                            onDelete={() => onDelete(list.id)}
                        />
                    ))}
                </ul>
            </DragDropProvider>

            {error && <p role="alert">{error}</p>}
        </>
    )
}