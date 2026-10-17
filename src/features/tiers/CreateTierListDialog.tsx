import { useId, useRef, useState } from 'react'
import { Modal } from '../../shared/components/Modal'
import { CakeArtwork } from './HearMeOutCake'
import type { CreateTierListInput } from './tier.repository'
import { tierStyles } from './tier.styles'
import type { TierStyleId } from './tier.styles'

export function CreateTierListDialog({
                                         onCreate,
                                         onClose,
                                     }: {
    onCreate: (input: CreateTierListInput) => Promise<boolean>
    onClose: () => void
}) {
    const nameId = useId()
    const [id] = useState(() => crypto.randomUUID())
    const [name, setName] = useState('')
    const [step, setStep] = useState<'name' | 'style'>('name')
    const [styleId, setStyleId] = useState<TierStyleId | null>(null)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const pendingRef = useRef(false)

    async function submit() {
        if (pendingRef.current) return

        const title = name.trim()

        if (!title) {
            setError('Bitte gib einen Namen ein.')
            return
        }

        if (step === 'name') {
            setError('')
            setStep('style')
            return
        }

        if (!styleId) return

        pendingRef.current = true
        setPending(true)
        setError('')

        try {
            if (await onCreate({ id, title, styleId })) {
                onClose()
            } else {
                setError('Die Tierliste konnte nicht erstellt werden.')
            }
        } catch {
            setError(
                'Die Tierliste konnte nicht erstellt werden. Bitte versuche es erneut.',
            )
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    return (
        <Modal
            title={step === 'name' ? 'Neue Tierliste' : 'Stil wählen'}
            busy={pending}
            onClose={onClose}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    void submit()
                }}
            >
                {step === 'name' ? (
                    <div>
                        <label htmlFor={nameId}>Name</label>

                        <input
                            id={nameId}
                            autoFocus
                            autoComplete="off"
                            value={name}
                            maxLength={120}
                            required
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                        />
                    </div>
                ) : (
                    <>
                        <p>{name.trim()}</p>

                        {tierStyles.map((style) => (
                            <button
                                key={style.id}
                                type="button"
                                className="tier-style-choice"
                                aria-label={style.name}
                                aria-pressed={style.id === styleId}
                                onClick={() => setStyleId(style.id)}
                            >
                                <span>{style.name}</span>

                                <span aria-hidden="true">
                                    {style.id === 'cake' ? (
                                        <CakeArtwork
                                            className="cake-style-preview"
                                        />
                                    ) : (
                                        <span className="tier-style-preview">
                                            {style.rows.map((row) => (
                                                <span
                                                    className="tier-style-preview__row"
                                                    key={row.label}
                                                >
                                                    <span
                                                        style={{
                                                            background: row.color,
                                                        }}
                                                    >
                                                        {row.label}
                                                    </span>
                                                    <span />
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => setStep('name')}
                        >
                            Name ändern
                        </button>
                    </>
                )}

                {error && <p role="alert">{error}</p>}

                <button
                    type="submit"
                    disabled={
                        pending ||
                        (step === 'style' && !styleId)
                    }
                >
                    {pending
                        ? 'Erstellen …'
                        : step === 'name'
                            ? 'Weiter'
                            : 'Erstellen'}
                </button>
            </form>
        </Modal>
    )
}