import { useId, useRef, useState } from 'react'
import { Modal } from './Modal'

interface NameDialogProps {
    title: string
    initialValue?: string
    onSave: (name: string) => Promise<boolean>
    onClose: () => void
}

export function NameDialog({
    title,
    initialValue = '',
    onSave,
    onClose,
}: NameDialogProps) {
    const inputId = useId()
    const [name, setName] = useState(initialValue)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const pendingRef = useRef(false)

    async function save() {
        if (pendingRef.current) return

        const trimmedName = name.trim()
        if (!trimmedName) {
            setError('Bitte gib einen Namen ein.')
            return
        }

        pendingRef.current = true
        setPending(true)
        setError('')

        try {
            if (await onSave(trimmedName)) {
                onClose()
            } else {
                setError('Der Name konnte nicht gespeichert werden.')
            }
        } catch {
            setError('Der Name konnte nicht gespeichert werden.')
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    return (
        <Modal title={title} busy={pending} onClose={onClose}>
            <form onSubmit={(event) => {
                event.preventDefault()
                void save()
            }}>
                <div>
                    <label htmlFor={inputId}>Name</label>
                    <input
                        id={inputId}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoFocus
                        autoComplete="off"
                        disabled={pending}
                        required
                    />
                </div>
                {initialValue && (
                    <p className="field-hint">Gespeichert: {initialValue}</p>
                )}
                {error && <p role="alert">{error}</p>}
                <button type="submit" disabled={pending}>
                    {pending ? 'Speichern …' : 'Speichern'}
                </button>
            </form>
        </Modal>
    )
}
