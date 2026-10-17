import { useEffect, useState } from 'react'
import { supabaseTierSharing } from '../../infrastructure/supabase/supabaseTierSharing'
import { supabaseProfileImageStore } from '../../infrastructure/supabase/supabaseProfileImageStore'
import { Modal } from '../../shared/components/Modal'
import type { TierList } from '../../shared/types/list.types'
import type { TierEntryDraft } from '../tiers/tier.repository'
import { AddTierEntryDialog } from '../tiers/AddTierEntryDialog'
import { ProfileImageContext } from '../images/ProfileImageContext'

type Choice =
    Awaited<ReturnType<typeof supabaseTierSharing.choices>>[number]

export function SharedTierAddDialog({
                                        list,
                                        onAdd,
                                        onClose,
                                    }: {
    list: TierList
    onAdd: (
        draft: TierEntryDraft,
        source?: Choice,
    ) => Promise<boolean>
    onClose: () => void
}) {
    const [choices, setChoices] = useState<Choice[] | null>(null)
    const [failed, setFailed] = useState(false)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true

        void supabaseTierSharing.choices(list.id).then(
            (data) => {
                if (active) setChoices(data)
            },
            () => {
                if (active) setFailed(true)
            },
        )

        return () => {
            active = false
        }
    }, [list.id, attempt])

    if (!choices) {
        return <Modal title="Neuer Eintrag" onClose={onClose}>
            {failed ? <>
                <p role="alert">
                    Der Katalog konnte nicht geladen werden.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setFailed(false)
                        setAttempt((value) => value + 1)
                    }}
                >
                    Erneut versuchen
                </button>
            </> : <p role="status">Katalog wird geladen …</p>}
        </Modal>
    }

    return <ProfileImageContext.Provider value={supabaseProfileImageStore}>
        <AddTierEntryDialog
            list={list}
            items={choices.map((choice) => choice.value)}
            onClose={onClose}
            onAdd={(draft) => onAdd(
                draft,
                draft.source === 'catalog'
                    ? choices.find(
                        (choice) => choice.value.id === draft.itemId,
                    )
                    : undefined,
            )}
        />
    </ProfileImageContext.Provider>
}