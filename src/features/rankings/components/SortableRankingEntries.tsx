import { useRef, useState } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import {
    Accessibility,
    KeyboardSensor,
    PointerActivationConstraints,
    PointerSensor,
} from '@dnd-kit/dom'
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/dom'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import type {
    EntryId,
    ItemId,
    RankingListEntry,
} from '../../../shared/types/list.types'
import { SwipeToReveal } from '../../../shared/components/SwipeToReveal'
import { ProfilePhoto } from '../../images/components/ProfilePhoto'
import { BackgroundPhoto } from '../../images/components/BackgroundPhoto'
import './RankingEntries.css'

const rankingSensors = [
    PointerSensor.configure({
        activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 6 }),
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

interface SortableRankingEntriesProps {
    entries: readonly RankingListEntry[]
    getItemName: (itemId: ItemId) => string
    getItemImageId: (itemId: ItemId) => string | null
    getItemBackgroundImageId: (itemId: ItemId) => string | null
    onDragChange?: (dragging: boolean) => void
    onEdit: (entryId: EntryId) => void
    onRemove: (entryId: EntryId) => Promise<boolean>
    onReorder: (
        entryId: EntryId,
        toIndex: number,
    ) => Promise<boolean>
}

interface SortableEntryProps {
    entry: RankingListEntry
    name: string
    imageId: string | null
    backgroundImageId: string | null
    index: number
    onEdit: () => void
    onRemove: () => Promise<boolean>
}

function SortableEntry({
                           entry,
                           name,
                           imageId,
                           backgroundImageId,
                           index,
                           onEdit,
                           onRemove,
                       }: SortableEntryProps) {
    const { ref, handleRef, isDragging } = useSortable({
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
                (backgroundImageId ? ' ranking-entry--background' : '') +
                (isDragging ? ' ranking-entry--dragging' : '')
            }
        >
            <SwipeToReveal label={name} onRemove={onRemove}>
                {backgroundImageId && (
                    <span
                        className="ranking-entry__background"
                        aria-hidden="true"
                    >
                        <BackgroundPhoto imageId={backgroundImageId} />
                    </span>
                )}

                <button
                    type="button"
                    className="ranking-entry__edit"
                    onClick={onEdit}
                    onContextMenu={(event) => event.preventDefault()}
                    aria-label={
                        name +
                        ', Position ' +
                        entry.position +
                        ', tippen zum Bearbeiten'
                    }
                >
                    <span
                        className="ranking-entry__position"
                        aria-hidden="true"
                    >
                        {entry.position}.
                    </span>

                    {imageId && (
                        <ProfilePhoto imageId={imageId} name={name} />
                    )}

                    <span className="ranking-entry__name">
                        {name}
                    </span>
                </button>

                <button
                    ref={handleRef}
                    type="button"
                    className="ranking-entry__drag"
                    data-drag-handle
                    aria-label={name + ' verschieben'}
                    title="Zum Verschieben ziehen"
                    onContextMenu={(event) => event.preventDefault()}
                >
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
                                           getItemImageId,
                                           getItemBackgroundImageId,
                                           onEdit,
                                           onRemove,
                                           onReorder,
                                           onDragChange,
                                       }: SortableRankingEntriesProps) {
    const [error, setError] = useState('')
    const suppressEditUntil = useRef(0)

    const orderedEntries = [...entries].sort(
        (first, second) => first.position - second.position,
    )

    return (
        <>
            <p className="sr-only">
                Tippen zum Bearbeiten. Zum Sortieren den
                ⠿-Griff ziehen. Nach links über den Namen
                wischen für weitere Aktionen.
            </p>

            <DragDropProvider
                sensors={rankingSensors}
                plugins={(defaults) => [
                    ...defaults,
                    Accessibility.configure({
                        screenReaderInstructions: {
                            draggable:
                                'Verschiebegriff mit Tab auswählen. ' +
                                'Leertaste zum Aufnehmen. ' +
                                'Mit den Pfeiltasten verschieben. ' +
                                'Leertaste zum Ablegen. ' +
                                'Escape zum Abbrechen.',
                        },
                        announcements: {
                            dragstart: () => 'Eintrag aufgenommen.',
                            dragover: ({
                                           operation: { source },
                                       }: DragOverEvent) => {
                                if (!isSortable(source)) return

                                const slot = orderedEntries[source.index]

                                return slot
                                    ? `Zielposition ${slot.position}.`
                                    : undefined
                            },
                            dragend: ({ canceled }: DragEndEvent) =>
                                canceled
                                    ? 'Verschieben abgebrochen.'
                                    : 'Verschieben beendet.',
                        },
                    }),
                ]}
                onDragStart={() => {
                    onDragChange?.(true)
                    suppressEditUntil.current = Number.POSITIVE_INFINITY
                    setError('')
                }}
                onDragEnd={async (event) => {
                    onDragChange?.(false)
                    suppressEditUntil.current = Date.now() + 200

                    if (event.canceled) return

                    const { source } = event.operation

                    if (
                        !isSortable(source) ||
                        source.initialIndex === source.index
                    ) return

                    try {
                        const reordered = await onReorder(
                            String(source.id),
                            source.index,
                        )

                        if (!reordered) {
                            setError(
                                'Die Reihenfolge konnte nicht geändert werden.',
                            )
                        }
                    } catch {
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
                            imageId={getItemImageId(entry.itemId)}
                            backgroundImageId={
                                getItemBackgroundImageId(entry.itemId)
                            }
                            onEdit={() => {
                                if (
                                    Date.now() >=
                                    suppressEditUntil.current
                                ) {
                                    onEdit(entry.id)
                                }
                            }}
                            onRemove={() => onRemove(entry.id)}
                        />
                    ))}
                </ol>
            </DragDropProvider>

            {error && <p role="alert">{error}</p>}
        </>
    )
}