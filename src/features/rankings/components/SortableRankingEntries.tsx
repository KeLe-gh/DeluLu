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
    EntryId,
    ItemId,
    RankingListEntry,
} from '../../../shared/types/list.types'
import { SwipeToReveal } from '../../../shared/components/SwipeToReveal'
import './RankingEntries.css'

const rankingSensors = [
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

interface SortableRankingEntriesProps {
    entries: readonly RankingListEntry[]
    getItemName: (itemId: ItemId) => string
    onEdit: (entryId: EntryId) => void
    onRemove: (entryId: EntryId) => boolean
    onReorder: (
        entryId: EntryId,
        toIndex: number,
    ) => boolean
}

interface SortableEntryProps {
    entry: RankingListEntry
    name: string
    index: number
    onEdit: () => void
    onRemove: () => boolean
}

function SortableEntry({
                           entry,
                           name,
                           index,
                           onEdit,
                           onRemove,
                       }: SortableEntryProps) {
    const {
        ref,
        handleRef,
        isDragging,
    } = useSortable({
        id: entry.id,
        index,
        data: { name },
    })

    return (
        <li
            ref={ref}
            value={entry.position}
            className={
                'ranking-entry' +
                (isDragging
                    ? ' ranking-entry--dragging'
                    : '')
            }
        >
            <SwipeToReveal
                label={name}
                onRemove={onRemove}
            >
                <button
                    ref={handleRef}
                    type="button"
                    className="ranking-entry__edit"
                    onClick={onEdit}
                    onContextMenu={(event) =>
                        event.preventDefault()
                    }
                    aria-label={
                        name +
                        ', Position ' +
                        entry.position +
                        ', tippen zum Bearbeiten, ' +
                        'halten zum Verschieben'
                    }
                >
                    <span
                        className="ranking-entry__position"
                        aria-hidden="true"
                    >
                        {entry.position}.
                    </span>

                    <span className="ranking-entry__name">
                        {name}
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

export function SortableRankingEntries({
                                           entries,
                                           getItemName,
                                           onEdit,
                                           onRemove,
                                           onReorder,
                                       }: SortableRankingEntriesProps) {
    const [error, setError] = useState('')
    const suppressEditUntil = useRef(0)

    const orderedEntries = [...entries].sort(
        (a, b) => a.position - b.position,
    )

    return (
        <>
            <p>
                Tippen zum Bearbeiten. Zum Sortieren kurz
                halten und ziehen. Nach links wischen
                für weitere Aktionen.
            </p>

            <DragDropProvider
                sensors={rankingSensors}
                plugins={(defaults) => [
                    ...defaults,
                    Accessibility.configure({
                        screenReaderInstructions: {
                            draggable:
                                'Enter zum Bearbeiten. ' +
                                'Leertaste zum Aufnehmen. ' +
                                'Mit den Pfeiltasten verschieben. ' +
                                'Leertaste zum Ablegen. ' +
                                'Escape zum Abbrechen.',
                        },
                        announcements: {
                            dragstart: () =>
                                'Eintrag aufgenommen.',

                            dragover: ({
                                           operation: { source },
                                       }: DragOverEvent) => {
                                if (!isSortable(source)) {
                                    return
                                }

                                const slot =
                                    orderedEntries[source.index]

                                return slot
                                    ? 'Zielposition ' +
                                    slot.position +
                                    '.'
                                    : undefined
                            },

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
                    suppressEditUntil.current =
                        Number.POSITIVE_INFINITY

                    setError('')
                }}
                onDragEnd={(event) => {
                    suppressEditUntil.current =
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

                    const reordered = onReorder(
                        String(source.id),
                        source.index,
                    )

                    if (!reordered) {
                        setError(
                            'Die Reihenfolge konnte nicht geändert werden.',
                        )
                    }
                }}
            >
                <ol className="ranking-entries">
                    {orderedEntries.map((entry, index) => (
                        <SortableEntry
                            key={entry.id}
                            entry={entry}
                            index={index}
                            name={getItemName(entry.itemId)}
                            onEdit={() => {
                                if (
                                    Date.now() >=
                                    suppressEditUntil.current
                                ) {
                                    onEdit(entry.id)
                                }
                            }}
                            onRemove={() =>
                                onRemove(entry.id)
                            }
                        />
                    ))}
                </ol>
            </DragDropProvider>

            {error && <p role="alert">{error}</p>}
        </>
    )
}