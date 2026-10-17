import { useId, useRef, useState } from 'react'
import { Modal } from '../../shared/components/Modal'
import type {
    MediaDraft,
    MediaKind,
    MediaStatus,
    MediaTitle,
} from './media.types'
import {
    mediaStatuses,
    mediaStatusLabels,
} from './media.types'

export function MediaTitleDialog({
                                     title,
                                     status,
                                     onSave,
                                     onClose,
                                 }: {
    title?: MediaTitle
    status: MediaStatus
    onSave: (
        draft: MediaDraft,
        revision: number | null,
    ) => Promise<boolean>
    onClose: () => void
}) {
    const prefix = useId()

    const [id] = useState(
        () => title?.id ?? crypto.randomUUID(),
    )
    const [revision] = useState(
        () => title?.revision ?? null,
    )

    const [name, setName] = useState(title?.name ?? '')
    const [kind, setKind] = useState<MediaKind>(
        title?.kind ?? 'series',
    )
    const [selectedStatus, setStatus] = useState(
        title?.status ?? status,
    )
    const [rating, setRating] = useState(
        title?.rating?.toString() ?? '',
    )

    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const pendingRef = useRef(false)

    async function submit() {
        if (pendingRef.current) return

        const score = rating.trim().replace(',', '.')

        if (!name.trim()) {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (
            score &&
            !/^(?:10(?:\.0)?|[0-9](?:\.[0-9])?)$/.test(score)
        ) {
            setError(
                'Bitte gib eine Bewertung von 0 bis 10 mit höchstens einer Nachkommastelle ein.',
            )
            return
        }

        pendingRef.current = true
        setPending(true)
        setError('')

        try {
            const saved = await onSave(
                {
                    id,
                    name: name.trim(),
                    kind,
                    status: selectedStatus,
                    rating: score ? Number(score) : null,
                },
                revision,
            )

            if (saved) onClose()
        } catch {
            setError(
                'Der Eintrag konnte nicht gespeichert werden.',
            )
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    return (
        <Modal
            title={
                title
                    ? 'Eintrag bearbeiten'
                    : 'Serie / Film hinzufügen'
            }
            busy={pending}
            onClose={onClose}
        >
            <form onSubmit={(event) => {
                event.preventDefault()
                void submit()
            }}>
                <div>
                    <label htmlFor={prefix + '-name'}>
                        Name
                    </label>

                    <input
                        id={prefix + '-name'}
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

                <div>
                    <label htmlFor={prefix + '-kind'}>
                        Typ
                    </label>

                    <select
                        id={prefix + '-kind'}
                        value={kind}
                        onChange={(event) =>
                            setKind(event.target.value as MediaKind)
                        }
                    >
                        <option value="series">Serie</option>
                        <option value="movie">Film</option>
                    </select>
                </div>

                <div>
                    <label htmlFor={prefix + '-status'}>
                        Status
                    </label>

                    <select
                        id={prefix + '-status'}
                        value={selectedStatus}
                        onChange={(event) =>
                            setStatus(event.target.value as MediaStatus)
                        }
                    >
                        {mediaStatuses.map((value) => (
                            <option key={value} value={value}>
                                {mediaStatusLabels[value]}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor={prefix + '-rating'}>
                        Bewertung (0–10)
                    </label>

                    <input
                        id={prefix + '-rating'}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="Optional, z. B. 9.5"
                        value={rating}
                        onChange={(event) =>
                            setRating(event.target.value)
                        }
                    />
                </div>

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={pending}>
                    {pending
                        ? 'Speichern …'
                        : title
                            ? 'Speichern'
                            : 'Hinzufügen'}
                </button>
            </form>
        </Modal>
    )
}