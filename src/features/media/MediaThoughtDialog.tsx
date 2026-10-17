import { useId, useRef, useState } from 'react'
import { Modal } from '../../shared/components/Modal'
import type {
    MediaThought,
    MediaThoughtDraft,
} from './mediaThought.types'

export function MediaThoughtDialog({
                                       titleId,
                                       thought,
                                       onSave,
                                       onClose,
                                   }: {
    titleId: string
    thought?: MediaThought
    onSave: (
        draft: MediaThoughtDraft,
        revision: number | null,
    ) => Promise<boolean>
    onClose: () => void
}) {
    const prefix = useId()

    const [id] = useState(
        () => thought?.id ?? crypto.randomUUID(),
    )
    const [revision] = useState(
        () => thought?.revision ?? null,
    )

    const [heading, setHeading] = useState(thought?.heading ?? '')
    const [body, setBody] = useState(thought?.body ?? '')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const busy = useRef(false)

    async function submit() {
        if (busy.current) return

        if (!body.trim()) {
            setError('Bitte schreibe einen Gedanken.')
            return
        }

        busy.current = true
        setPending(true)
        setError('')

        try {
            const saved = await onSave(
                {
                    id,
                    titleId,
                    heading: heading.trim(),
                    body: body.trim(),
                },
                revision,
            )

            if (saved) onClose()
        } catch {
            setError('Der Gedanke konnte nicht gespeichert werden.')
        } finally {
            busy.current = false
            setPending(false)
        }
    }

    return (
        <Modal
            title={thought ? 'Gedanke bearbeiten' : 'Neuer Gedanke'}
            busy={pending}
            onClose={onClose}
        >
            <form onSubmit={(event) => {
                event.preventDefault()
                void submit()
            }}>
                <div>
                    <label htmlFor={prefix + '-heading'}>
                        Titel (optional)
                    </label>

                    <input
                        id={prefix + '-heading'}
                        autoFocus
                        autoComplete="off"
                        maxLength={120}
                        placeholder="Zum Beispiel: Folge 12"
                        value={heading}
                        onChange={(event) =>
                            setHeading(event.target.value)
                        }
                    />
                </div>

                <div>
                    <label htmlFor={prefix + '-body'}>
                        Deine Gedanken
                    </label>

                    <textarea
                        id={prefix + '-body'}
                        rows={7}
                        maxLength={20000}
                        required
                        value={body}
                        onChange={(event) =>
                            setBody(event.target.value)
                        }
                    />
                </div>

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={pending}>
                    {pending ? 'Speichern …' : 'Speichern'}
                </button>
            </form>
        </Modal>
    )
}