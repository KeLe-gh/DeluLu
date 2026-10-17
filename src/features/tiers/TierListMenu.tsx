import { useState } from 'react'
import { SwipeToReveal } from '../../shared/components/SwipeToReveal'
import { NameDialog } from '../../shared/components/NameDialog'
import type { TierList } from '../../shared/types/list.types'
import './TierListMenu.css'

export function TierListMenu({
                                 lists,
                                 disabled,
                                 onOpen,
                                 onRename,
                                 onDelete,
                             }: {
    lists: readonly TierList[]
    disabled: boolean
    onOpen: (id: string) => void
    onRename: (id: string, title: string) => Promise<boolean>
    onDelete: (id: string) => Promise<boolean>
}) {
    const [managedId, setManagedId] = useState<string | null>(null)

    const managed = lists.find(
        (list) => list.id === managedId,
    )

    return (
        <>
            <nav aria-label="Tierlisten" inert={disabled}>
                <ul className="tier-list-menu">
                    {lists.map((list) => (
                        <li key={list.id}>
                            <SwipeToReveal
                                label={list.title}
                                onRename={() => setManagedId(list.id)}
                                onRemove={() => onDelete(list.id)}
                                removeLabel="Löschen"
                                removeAriaLabel={
                                    'Liste ' + list.title + ' löschen'
                                }
                                removeError="Die Tierliste konnte nicht gelöscht werden."
                            >
                                <button
                                    type="button"
                                    className="tier-list-menu__open"
                                    aria-label={list.title}
                                    onClick={() => onOpen(list.id)}
                                    onContextMenu={(event) =>
                                        event.preventDefault()
                                    }
                                >
                                    <span
                                        className="tier-list-menu__icon"
                                        aria-hidden="true"
                                    >
                                        {list.styleId === 'cake' ? '🍰' : '▤'}
                                    </span>

                                    <span className="tier-list-menu__name">
                                        <strong>{list.title}</strong>

                                        <span className="tier-list-menu__subtitle">
                                            {list.styleId === 'cake'
                                                ? 'Hear me out cake'
                                                : 'Klassisch'}
                                            {' · '}
                                            {list.entries.length}
                                        </span>
                                    </span>
                                </button>
                            </SwipeToReveal>
                        </li>
                    ))}
                </ul>
            </nav>

            {managed && (
                <NameDialog
                    key={managed.id}
                    title="Liste umbenennen"
                    initialValue={managed.title}
                    onSave={(title) =>
                        onRename(managed.id, title)
                    }
                    onClose={() => setManagedId(null)}
                />
            )}
        </>
    )
}