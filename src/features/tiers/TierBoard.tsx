import { useRef, useState, type ReactNode } from 'react'
import {
    DragDropProvider,
    useDraggable,
    useDroppable,
} from '@dnd-kit/react'
import {
    Accessibility,
    Feedback,
    KeyboardSensor,
    PointerActivationConstraints,
    PointerSensor,
} from '@dnd-kit/dom'
import type {
    DragEndEvent,
    DragMoveEvent,
    DragOverEvent,
    DragStartEvent,
} from '@dnd-kit/dom'
import type { CatalogItem } from '../catalog'
import type {
    TierList,
    TierListEntry,
} from '../../shared/types/list.types'
import { ProfilePhoto } from '../images/components/ProfilePhoto'

const poolId = 'tier-pool'

const sensors = [
    PointerSensor.configure({
        activationConstraints: [
            new PointerActivationConstraints.Distance({
                value: 5,
            }),
        ],
    }),
    KeyboardSensor.configure({
        keyboardCodes: {
            start: ['Space', 'Enter'],
            end: ['Space', 'Enter', 'Tab'],
            cancel: ['Escape'],
            up: ['ArrowUp'],
            down: ['ArrowDown'],
            left: ['ArrowLeft'],
            right: ['ArrowRight'],
        },
    }),
]

type Placement = {
    entryId: string
    tierId: string | null
    index: number
}

function DropArea({
                      id,
                      label,
                      className,
                      disabled,
                      children,
                  }: {
    id: string
    label: string
    className: string
    disabled: boolean
    children: ReactNode
}) {
    const { ref, isDropTarget } = useDroppable({
        id,
        type: 'tier-group',
        accept: 'tier-entry',
        disabled,
        collisionPriority: 1,
    })

    return (
        <div
            ref={ref}
            role="group"
            aria-label={label}
            data-tier-group={id}
            className={
                className + (isDropTarget ? ' tier-drop-active' : '')
            }
        >
            {children}
        </div>
    )
}

function Tile({
                  entry,
                  item,
                  disabled,
                  marker,
              }: {
    entry: TierListEntry
    item: CatalogItem | undefined
    disabled: boolean
    marker?: 'before' | 'after'
}) {
    const name = item?.name ?? 'Profil'

    const drag = useDraggable({
        id: entry.id,
        type: 'tier-entry',
        disabled,
        data: { name },
    })

    const drop = useDroppable({
        id: entry.id,
        type: 'tier-entry',
        accept: 'tier-entry',
        disabled,
    })

    return (
        <button
            type="button"
            ref={(element) => {
                drag.ref(element)
                drop.ref(element)
            }}
            className={
                'tier-drag-tile' +
                (marker ? ' tier-insert-' + marker : '')
            }
            data-tier-entry={entry.id}
            aria-label={name + ' verschieben'}
            title={name}
            aria-disabled={disabled}
            aria-pressed={drag.isDragging}
            onContextMenu={(event) => event.preventDefault()}
        >
            <ProfilePhoto
                imageId={item?.profileImageId ?? null}
                name={name}
            />
        </button>
    )
}

export function TierBoard({
                              list,
                              items,
                              disabled,
                              onMove,
                          }: {
    list: TierList
    items: readonly CatalogItem[]
    disabled: boolean
    onMove: (
        entryId: string,
        tierId: string | null,
        index: number,
    ) => Promise<void>
}) {
    const [placement, setPlacement] = useState<Placement | null>(null)
    const finishing = useRef(false)
    const profiles = new Map(items.map((item) => [item.id, item]))

    function locate(
        event: Pick<DragEndEvent, 'operation'>,
    ): Placement | null {
        const { source, target } = event.operation

        if (!source || !target || target.id === source.id) return null

        const entryId = String(source.id)

        const targetEntry = list.entries.find(
            (entry) => entry.id === target.id,
        )

        const tierId = targetEntry
            ? targetEntry.tierId
            : target.id === poolId
                ? null
                : String(target.id)

        if (
            tierId !== null &&
            !list.tiers.some((tier) => tier.id === tierId)
        ) {
            return null
        }

        const group = list.entries.filter(
            (entry) =>
                entry.tierId === tierId &&
                entry.id !== entryId,
        )

        let index = group.length

        if (targetEntry) {
            index = group.findIndex(
                (entry) => entry.id === targetEntry.id,
            )

            const shape = target.shape
            const center = event.operation.shape?.current.center

            const after = shape && center && (
                center.y >
                shape.center.y + shape.boundingRectangle.height / 2 ||
                (
                    Math.abs(center.y - shape.center.y) <=
                    shape.boundingRectangle.height / 2 &&
                    center.x > shape.center.x
                )
            )

            if (after) index += 1
        }

        return { entryId, tierId, index }
    }

    function preview(event: DragMoveEvent | DragOverEvent) {
        const next = locate(event)

        setPlacement((previous) =>
            previous?.entryId === next?.entryId &&
            previous?.tierId === next?.tierId &&
            previous?.index === next?.index
                ? previous
                : next,
        )
    }

    function tiles(tierId: string | null) {
        const group = list.entries.filter(
            (entry) => entry.tierId === tierId,
        )

        const remaining = group.filter(
            (entry) => entry.id !== placement?.entryId,
        )

        const before = placement?.tierId === tierId
            ? remaining[placement.index]?.id
            : undefined

        const after =
            placement?.tierId === tierId &&
            placement.index === remaining.length
                ? remaining.at(-1)?.id
                : undefined

        return group.map((entry) => (
            <Tile
                key={entry.id}
                entry={entry}
                item={profiles.get(entry.itemId)}
                disabled={disabled}
                marker={
                    before === entry.id
                        ? 'before'
                        : after === entry.id
                            ? 'after'
                            : undefined
                }
            />
        ))
    }

    return (
        <DragDropProvider
            sensors={sensors}
            plugins={(defaults) => [
                ...defaults,
                Feedback.configure({ feedback: 'clone' }),
                Accessibility.configure({
                    screenReaderInstructions: {
                        draggable:
                            'Leertaste zum Aufnehmen, Pfeiltasten zum Verschieben, ' +
                            'Leertaste zum Ablegen. Escape bricht ab.',
                    },
                    announcements: {
                        dragstart: ({ operation }: DragStartEvent) =>
                            String(
                                operation.source?.data.name ?? 'Profil',
                            ) + ' aufgenommen.',

                        dragover: ({ operation }: DragOverEvent) => {
                            const next = locate({ operation })

                            if (!next) return

                            const label = list.tiers.find(
                                (tier) => tier.id === next.tierId,
                            )?.label ?? 'Nicht zugeordnet'

                            return label + ', Position ' + (next.index + 1)
                        },

                        dragend: ({ canceled }: DragEndEvent) =>
                            canceled
                                ? 'Verschieben abgebrochen.'
                                : 'Profil abgelegt.',
                    },
                }),
            ]}
            onBeforeDragStart={(event) => {
                if (disabled || finishing.current) {
                    event.preventDefault()
                }
            }}
            onDragMove={preview}
            onDragOver={preview}
            onDragEnd={async (event) => {
                const next = !event.canceled ? locate(event) : null

                setPlacement(null)

                if (!next || disabled || finishing.current) return

                finishing.current = true

                try {
                    await onMove(
                        next.entryId,
                        next.tierId,
                        next.index,
                    )
                } finally {
                    finishing.current = false
                }
            }}
        >
            <div className="tier-board" aria-label="Tierliste">
                {list.tiers.map((tier) => (
                    <div className="tier-board__row" key={tier.id}>
                        <span
                            className="tier-board__label"
                            style={{ background: tier.color }}
                        >
                            {tier.label}
                        </span>

                        <DropArea
                            id={tier.id}
                            label={'Tier ' + tier.label}
                            className="tier-board__items tier-drop-zone"
                            disabled={disabled}
                        >
                            {tiles(tier.id)}
                        </DropArea>
                    </div>
                ))}
            </div>

            <section
                className="tier-unassigned"
                aria-label="Nicht zugeordnet"
            >
                <h2>Nicht zugeordnet</h2>

                <DropArea
                    id={poolId}
                    label="Nicht zugeordnete Profile"
                    className="tier-pool tier-drop-zone"
                    disabled={disabled}
                >
                    {tiles(null)}

                    {list.entries.every(
                        (entry) => entry.tierId !== null,
                    ) && (
                        <span className="tier-pool__empty">
                            {list.entries.length
                                ? 'Hier ablegen'
                                : 'Noch keine Einträge.'}
                        </span>
                    )}
                </DropArea>
            </section>
        </DragDropProvider>
    )
}