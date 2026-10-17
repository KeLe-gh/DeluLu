import { useRef, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import type {
    ItemId,
    RankingList,
} from '../../../shared/types/list.types'
import { getRankingSize } from '../model/ranking.operations'
import { PhotoPicker } from '../../images/components/PhotoPicker'
import { CatalogProfilePicker } from '../../catalog/components/CatalogProfilePicker'

interface CreateRankingEntryDialogProps {
    list: RankingList
    catalogItems: readonly {
        id: ItemId
        name: string
        profileImageId: string | null
    }[]
    onAddEntry: (
        name: string,
        position: number,
        photo?: Blob | null,
    ) => Promise<boolean>
    onAddExistingEntry: (
        itemId: ItemId,
        position: number,
    ) => Promise<boolean>
    onClose: () => void
}

export function CreateRankingEntryDialog({
                                             list,
                                             catalogItems,
                                             onAddEntry,
                                             onAddExistingEntry,
                                             onClose,
                                         }: CreateRankingEntryDialogProps) {
    const [mode, setMode] = useState<'new' | 'existing'>('new')
    const [name, setName] = useState('')
    const [itemId, setItemId] = useState('')
    const [position, setPosition] = useState(
        String(getRankingSize(list) + 1),
    )
    const [pending, setPending] = useState(false)
    const [photo, setPhoto] = useState<Blob | null>(null)
    const [preparingPhoto, setPreparingPhoto] = useState(false)
    const [error, setError] = useState('')
    const pendingRef = useRef(false)

    const usedIds = new Set(
        list.entries.map((entry) => entry.itemId),
    )

    const available = catalogItems
        .filter((item) => !usedIds.has(item.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'de-CH'))

    const selected = available.find((item) => item.id === itemId)

    async function save() {
        if (pendingRef.current || preparingPhoto) return

        const newPosition = Number(position)

        if (!Number.isSafeInteger(newPosition) || newPosition < 1) {
            setError('Bitte gib eine gültige Position ab 1 ein.')
            return
        }

        if (mode === 'new' && !name.trim()) {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (mode === 'existing' && !selected) {
            setError('Bitte wähle ein Profil.')
            return
        }

        pendingRef.current = true
        setPending(true)
        setError('')

        try {
            const saved = mode === 'new'
                ? await onAddEntry(name.trim(), newPosition, photo)
                : await onAddExistingEntry(itemId, newPosition)

            if (saved) {
                onClose()
            } else {
                setError('Der Eintrag konnte nicht gespeichert werden.')
            }
        } catch {
            setError('Der Eintrag konnte nicht gespeichert werden.')
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    return (
        <Modal
            title="Neuer Eintrag"
            busy={pending || preparingPhoto}
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
                        aria-pressed={mode === 'existing'}
                        onClick={() => {
                            setMode('existing')
                            setError('')
                        }}
                    >
                        Aus Katalog
                    </button>
                </div>

                {mode === 'new' ? (
                    <div>
                        <label htmlFor="new-entry-name">
                            Name
                        </label>

                        <input
                            id="new-entry-name"
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                            autoFocus
                            autoComplete="off"
                            disabled={pending}
                            required
                        />
                    </div>
                ) : (
                    <CatalogProfilePicker
                        items={available}
                        value={itemId}
                        disabled={pending || preparingPhoto}
                        onChange={(id) => {
                            setItemId(id)
                            setError('')
                        }}
                    />
                )}

                {mode === 'new' ? (
                    <PhotoPicker
                        imageId={null}
                        value={photo}
                        onChange={(value) =>
                            setPhoto(value ?? null)
                        }
                        onBusyChange={setPreparingPhoto}
                        name={name}
                    />
                ) : null}

                <div>
                    <label htmlFor="new-entry-position">
                        Position
                    </label>

                    <input
                        id="new-entry-position"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={position}
                        onChange={(event) =>
                            setPosition(event.target.value)
                        }
                        disabled={pending}
                        required
                    />
                </div>

                {error && <p role="alert">{error}</p>}

                <button
                    type="submit"
                    disabled={
                        pending ||
                        preparingPhoto ||
                        (mode === 'existing' && !selected)
                    }
                >
                    {pending ? 'Speichern …' : 'Hinzufügen'}
                </button>
            </form>
        </Modal>
    )
}