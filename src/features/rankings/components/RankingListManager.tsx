import { useRef, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import type { RankingList } from '../../../shared/types/list.types'

interface RankingListManagerProps {
    list: RankingList
    onRename: (title: string) => Promise<boolean>
    onCancel: () => void
}

export function RankingListManager({
                                       list,
                                       onRename,
                                       onCancel,
                                   }: RankingListManagerProps) {
    const [title, setTitle] = useState(list.title)
    const [error, setError] = useState('')
    const [pending, setPending] = useState(false)
    const pendingRef = useRef(false)

    async function rename() {
        if (pendingRef.current) {
            return
        }

        const trimmedTitle = title.trim()

        if (trimmedTitle === '') {
            setError('Bitte gib einen Listennamen ein.')
            return
        }

        pendingRef.current = true
        setPending(true)
        setError('')

        try {
            if (!await onRename(trimmedTitle)) {
                setError('Die Liste konnte nicht umbenannt werden.')
            }
        } catch {
            setError('Die Liste konnte nicht umbenannt werden.')
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    return (
        <Modal
            title="Liste umbenennen"
            busy={pending}
            onClose={onCancel}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    void rename()
                }}
            >
                <div>
                    <label htmlFor="rename-list-title">
                        Listenname
                    </label>

                    <input
                        id="rename-list-title"
                        type="text"
                        autoFocus
                        value={title}
                        onChange={(event) =>
                            setTitle(event.target.value)
                        }
                        disabled={pending}
                        required
                    />
                </div>

                <p>Gespeicherter Listenname: {list.title}</p>

                {error && <p role="alert">{error}</p>}

                <button type="submit" disabled={pending}>
                    {pending ? 'Name wird gespeichert …' : 'Speichern'}
                </button>
            </form>
        </Modal>
    )
}