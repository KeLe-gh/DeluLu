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
    const [background, setBackground] = useState<Blob | null>(null)
    const [preparingPhoto, setPreparingPhoto] = useState(false)
    const [preparingBackground, setPreparingBackground] = useState(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const working = useRef(false)

    const preparing = preparingPhoto || preparingBackground

    const available = items
        .filter((item) =>
            !list.entries.some((entry) => entry.itemId === item.id),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'de-CH'))

    const selected = available.find((item) => item.id === itemId)

    async function save() {
        if (working.current || preparing) return

        if (mode === 'new' && !name.trim()) {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (mode === 'catalog' && !selected) {
            setError('Bitte wähle ein Profil.')
            return
        }

        working.current = true
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
                    background,
                }
                : {
                    id: entryId,
                    itemId,
                    source: 'catalog',
                }

            if (await onAdd(draft)) onClose()
        } catch {
            setError(
                'Der Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.',
            )
        } finally {
            working.current = false
            setPending(false)
        }
    }

    return <Modal
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

            {mode === 'new' ? <>
                <div>
                    <label htmlFor={nameId}>Name</label>
                    <input
                        id={nameId}
                        autoFocus
                        autoComplete="off"
                        maxLength={120}
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                </div>

                <PhotoPicker
                    imageId={null}
                    value={photo}
                    name={name}
                    onChange={(value) => setPhoto(value ?? null)}
                    onBusyChange={setPreparingPhoto}
                />

                <PhotoPicker
                    kind="background"
                    imageId={null}
                    value={background}
                    name={name}
                    onChange={(value) => setBackground(value ?? null)}
                    onBusyChange={setPreparingBackground}
                />
            </> : <CatalogProfilePicker
                items={available}
                value={itemId}
                disabled={pending || preparing}
                onChange={(id) => {
                    setItemId(id)
                    setError('')
                }}
            />}

            {error && <p role="alert">{error}</p>}

            <button
                type="submit"
                disabled={
                    pending ||
                    preparing ||
                    (mode === 'catalog' && !selected)
                }
            >
                {pending ? 'Speichern …' : 'Hinzufügen'}
            </button>
        </form>
    </Modal>
}