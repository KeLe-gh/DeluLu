import { useId, useRef, useState } from 'react'
import { Modal } from '../../shared/components/Modal'

export function TierLabelEditor({
                                    label,
                                    onSave,
                                    onClose,
                                }: {
    label: string
    onSave: (label: string) => Promise<boolean>
    onClose: () => void
}) {
    const inputId = useId()
    const [name, setName] = useState(label)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const working = useRef(false)

    async function save() {
        if (working.current) return

        const value = name.trim()
        const hasControlCharacters = [...value].some((character) => {
            const code = character.charCodeAt(0)
            return code < 32 || code === 127
        })

        if (!value || value.length > 32 || hasControlCharacters) {
            setError('Bitte gib einen Namen mit 1 bis 32 Zeichen ein.')
            return
        }

        working.current = true
        setBusy(true)
        setError('')

        try {
            if (await onSave(value)) onClose()
        } catch {
            setError('Der Name konnte nicht gespeichert werden.')
        } finally {
            working.current = false
            setBusy(false)
        }
    }

    return (
        <Modal
            title="Tier umbenennen"
            busy={busy}
            onClose={onClose}
        >
            <form onSubmit={(event) => {
                event.preventDefault()
                void save()
            }}>
                <div>
                    <label htmlFor={inputId}>Name</label>
                    <input
                        id={inputId}
                        autoFocus
                        autoComplete="off"
                        maxLength={32}
                        required
                        value={name}
                        onChange={(event) => {
                            setName(event.target.value)
                            setError('')
                        }}
                    />
                </div>

                {error && <p role="alert">{error}</p>}

                <button
                    type="submit"
                    disabled={busy || !name.trim()}
                >
                    Speichern
                </button>
            </form>
        </Modal>
    )
}