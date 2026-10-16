import { useRef, useState } from 'react'
import type {
    RankingList,
} from '../../../shared/types/list.types'

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
            const saved = await onRename(trimmedTitle)

            if (!saved) {
                setError(
                    'Die Liste konnte nicht umbenannt werden.',
                )
            }
        } catch {
            setError(
                'Die Liste konnte nicht umbenannt werden.',
            )
        } finally {
            pendingRef.current = false
            setPending(false)
        }
    }

    return (
        <main>
            <h1>Liste umbenennen</h1>
            <p>Gespeicherter Listenname: {list.title}</p>

            <form
                onSubmit={(event) => {
                    event.preventDefault()
                    void rename()
                }}
            >
                <label htmlFor="rename-list-title">
                    Listenname
                </label>

                <input
                    id="rename-list-title"
                    type="text"
                    value={title}
                    onChange={(event) =>
                        setTitle(event.target.value)
                    }
                    disabled={pending}
                    required
                />

                <button type="submit" disabled={pending}>
                    {pending
                        ? 'Name wird gespeichert …'
                        : 'Umbenennen'}
                </button>

                {error && <p role="alert">{error}</p>}
            </form>

            <button
                type="button"
                onClick={onCancel}
                disabled={pending}
            >
                Abbrechen
            </button>
        </main>
    )
}