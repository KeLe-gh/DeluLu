import { useId, useRef, useState } from 'react'
import type { CatalogItem } from '../catalog'
import type { TierList } from '../../shared/types/list.types'
import { Modal } from '../../shared/components/Modal'
import { PhotoPicker } from '../images/components/PhotoPicker'
import { CatalogProfilePicker } from '../catalog/components/CatalogProfilePicker'
import type { TierEntryDraft } from './tier.repository'

export function AddTierEntryDialog({
                                       list,
                                       items,
                                       onAdd,
                                       onClose,
                                   }: {
    list: TierList
    items: readonly CatalogItem[]
    onAdd: (draft: TierEntryDraft) => Promise<boolean>
    onClose: () => void
}) {
    const nameId = useId()

    const [entryId] = useState(() => crypto.randomUUID())
    const [newItemId] = useState(() => crypto.randomUUID())
    const [mode, setMode] = useState<'new' | 'catalog'>('new')
    const [name, setName] = useState('')
    const [itemId, setItemId] = useState('')
    const [photo, setPhoto] = useState<Blob | null>(null)
    const [preparing, setPreparing] = useState(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const pendingRef = useRef(false)

    const used = new Set(
        list.entries.map((entry) => entry.itemId),
    )

    const available = items
        .filter((item) => !used.has(item.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'de-CH'))

    const selected = available.find((item) => item.id === itemId)
    const targetId = mode === 'new' ? newItemId : itemId

    const alreadyAdded = list.entries.some((entry) =>
        entry.id === entryId && entry.itemId === targetId,
    )

    async function save() {
        if (pendingRef.current || preparing) return

        if (alreadyAdded) {
            onClose()
            return
        }

        if (mode === 'new' && !name.trim()) {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (mode === 'catalog' && !selected) {
            setError('Bitte wähle ein Profil.')
            return
        }

        pendingRef.current = true
        setPending(true)
        setError('')

        try {
            const draft: TierEntryDraft = mode === 'new'
                ? {
                    id: entryId,
                    itemId: newItemId,
                    source: 'new',
                    name: name.trim(),
                    photo,
                }
                : {
                    id: entryId,
                    itemId,
                    source: 'catalog',
                }

            if (await onAdd(draft)) {
                onClose()
            }
        } catch {
            setError(
                'Der Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.',
            )
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    return (
        <Modal
            title="Neuer Eintrag"
            busy={pending || preparing}
            onClose={onClose}
        >
            <form onSubmit={(event) => {
                event.preventDefault()
                void save()
            }}>
                <div
                    className="segmented"
                    role="group"
                    aria-label="Profilquelle"
                >
                    <button
                        type="button"
                        aria-pressed={mode === 'new'}
                        onClick={() => {
                            setMode('new')
                            setError('')
                        }}
                    >
                        Neu
                    </button>

                    <button
                        type="button"
                        aria-pressed={mode === 'catalog'}
                        onClick={() => {
                            setMode('catalog')
                            setError('')
                        }}
                    >
                        Aus Katalog
                    </button>
                </div>

                {mode === 'new' ? (
                    <>
                        <div>
                            <label htmlFor={nameId}>Name</label>

                            <input
                                id={nameId}
                                autoFocus
                                autoComplete="off"
                                maxLength={120}
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                required
                            />
                        </div>

                        <PhotoPicker
                            imageId={null}
                            value={photo}
                            name={name}
                            onChange={(value) =>
                                setPhoto(value ?? null)
                            }
                            onBusyChange={setPreparing}
                        />
                    </>
                ) : (
                    <CatalogProfilePicker
                        items={available}
                        value={itemId}
                        disabled={pending || preparing}
                        onChange={(id) => {
                            setItemId(id)
                            setError('')
                        }}
                    />
                )}

                {error && <p role="alert">{error}</p>}

                <button
                    type="submit"
                    disabled={
                        pending ||
                        preparing ||
                        (mode === 'catalog' && !selected && !alreadyAdded)
                    }
                >
                    {pending ? 'Speichern …' : 'Hinzufügen'}
                </button>
            </form>
        </Modal>
    )
}