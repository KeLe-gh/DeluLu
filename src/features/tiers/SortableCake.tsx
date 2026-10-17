import { useRef } from 'react'
import {
    DragDropProvider,
    useDraggable,
    useDroppable,
} from '@dnd-kit/react'
import {
    Feedback,
    KeyboardSensor,
    PointerActivationConstraints,
    PointerSensor,
} from '@dnd-kit/dom'
import type { CatalogItem } from '../catalog'
import type {
    TierList,
    TierListEntry,
} from '../../shared/types/list.types'
import { ProfilePhoto } from '../images/components/ProfilePhoto'
import { CakeArtwork } from './HearMeOutCake'
import './HearMeOutCake.css'

const sensors = [
    PointerSensor.configure({
        activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 5 }),
        ],
    }),
    KeyboardSensor,
]

function Pin({
                 entry,
                 item,
                 disabled,
             }: {
    entry: TierListEntry
    item?: CatalogItem
    disabled: boolean
}) {
    const drag = useDraggable({
        id: entry.id,
        type: 'cake-pin',
        disabled,
    })

    const drop = useDroppable({
        id: entry.id,
        type: 'cake-pin',
        accept: 'cake-pin',
        disabled,
    })

    return (
        <button
            type="button"
            className="cake-pin-button"
            data-cake-entry={entry.id}
            ref={(element) => {
                drag.ref(element)
                drop.ref(element)
            }}
            aria-label={(item?.name ?? 'Profil') + ' verschieben'}
            title={item?.name}
            aria-disabled={disabled}
            aria-pressed={drag.isDragging}
            onContextMenu={(event) => event.preventDefault()}
        >
            <ProfilePhoto
                imageId={item?.profileImageId ?? null}
                name={item?.name}
            />
        </button>
    )
}

export function SortableCake({
                                 list,
                                 items,
                                 disabled,
                                 onMove,
                                 onDragChange,
                             }: {
    list: TierList
    items: readonly CatalogItem[]
    disabled: boolean
    onDragChange?: (dragging: boolean) => void
    onMove: (
        id: string,
        tierId: string | null,
        index: number,
    ) => Promise<void>
}) {
    const finishing = useRef(false)
    const profiles = new Map(items.map((item) => [item.id, item]))
    const rows = Math.max(1, Math.ceil(list.entries.length / 5))
    const height = 340 + (rows - 1) * 86

    const pins = list.entries.map((entry, index) => {
        const row = Math.floor(index / 5)
        const column = index % 5
        const count = Math.min(5, list.entries.length - row * 5)

        return {
            entry,
            row,
            x: 200 + (column - (count - 1) / 2) * 68,
            y: height - 255 - row * 86 + (column % 2 ? -8 : 4),
            angle: [-7, 5, -3, 7, -5][column],
        }
    })

    return (
        <DragDropProvider
            sensors={sensors}
            plugins={(defaults) => [
                ...defaults,
                Feedback.configure({ feedback: 'clone' }),
            ]}
            onBeforeDragStart={(event) => {
                if (disabled || finishing.current) {
                    event.preventDefault()
                }
            }}
            onDragStart={() => onDragChange?.(true)}
            onDragEnd={async ({ operation, canceled }) => {
                onDragChange?.(false)

                const { source, target } = operation

                if (
                    canceled ||
                    disabled ||
                    finishing.current ||
                    !source ||
                    !target ||
                    source.id === target.id
                ) return

                const index = list.entries.findIndex(
                    (entry) => entry.id === target.id,
                )

                if (index < 0) return
                finishing.current = true

                try {
                    await onMove(String(source.id), null, index)
                } finally {
                    finishing.current = false
                }
            }}
        >
            <figure
                className="hear-me-out-cake"
                aria-label={
                    'Hear me out cake mit ' +
                    list.entries.length +
                    ' Profilen'
                }
            >
                <div
                    className="cake-stage"
                    style={{ aspectRatio: '400 / ' + height }}
                >
                    <div className="cake-base">
                        <CakeArtwork />
                    </div>

                    <svg
                        className="cake-sticks"
                        viewBox={'0 0 400 ' + height}
                        aria-hidden="true"
                        focusable="false"
                    >
                        {pins.map((pin) => (
                            <g key={pin.entry.id}>
                                <line
                                    x1={pin.x}
                                    y1={pin.y + 48}
                                    x2={pin.x * .82 + 36}
                                    y2={
                                        height - 125 +
                                        (pin.row % 2) * 8
                                    }
                                    stroke="#ac8555"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                />
                                <line
                                    x1={pin.x - 1}
                                    y1={pin.y + 48}
                                    x2={pin.x * .82 + 35}
                                    y2={
                                        height - 126 +
                                        (pin.row % 2) * 8
                                    }
                                    stroke="#ecd0a0"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </g>
                        ))}
                    </svg>

                    {pins.map((pin) => (
                        <div
                            key={pin.entry.id}
                            className="cake-pin"
                            style={{
                                left: pin.x / 4 + '%',
                                top: pin.y / height * 100 + '%',
                                transform:
                                    'translateX(-50%) rotate(' +
                                    pin.angle + 'deg)',
                                zIndex: 10 + rows - pin.row,
                            }}
                        >
                            <Pin
                                entry={pin.entry}
                                item={profiles.get(pin.entry.itemId)}
                                disabled={disabled}
                            />
                        </div>
                    ))}
                </div>
            </figure>
        </DragDropProvider>
    )
}