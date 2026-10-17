import { useEffect, useState } from 'react'
import { getSharedAddCatalog } from '../../infrastructure/supabase/supabaseSharedRankingAdd'
import type { SharedCatalogChoice } from '../../infrastructure/supabase/supabaseSharedRankingAdd'
import { supabaseProfileImageStore } from '../../infrastructure/supabase/supabaseProfileImageStore'
import { Modal } from '../../shared/components/Modal'
import type { RankingList } from '../../shared/types/list.types'
import { ProfileImageContext } from '../images/ProfileImageContext'
import { CreateRankingEntryDialog } from '../rankings/components/CreateRankingEntryDialog'

export function SharedRankingAddDialog({
                                           list,
                                           onNew,
                                           onExisting,
                                           onClose,
                                       }: {
    list: RankingList
    onNew: (
        name: string,
        position: number,
        photo?: Blob | null,
        background?: Blob | null,
    ) => Promise<boolean>
    onExisting: (
        source: SharedCatalogChoice,
        position: number,
    ) => Promise<boolean>
    onClose: () => void
}) {
    const [attempt, setAttempt] = useState(0)

    const [result, setResult] = useState<{
        attempt: number
        choices: SharedCatalogChoice[] | null
    } | null>(null)

    const current =
        result?.attempt === attempt ? result : null

    useEffect(() => {
        let active = true

        void getSharedAddCatalog(list.id).then(
            (choices) => {
                if (active) {
                    setResult({ attempt, choices })
                }
            },
            () => {
                if (active) {
                    setResult({
                        attempt,
                        choices: null,
                    })
                }
            },
        )

        return () => {
            active = false
        }
    }, [list.id, attempt])

    if (!current || !current.choices) {
        return (
            <Modal
                title="Neuer Eintrag"
                onClose={onClose}
            >
                {!current ? (
                    <p role="status">
                        Katalog wird geladen …
                    </p>
                ) : (
                    <>
                        <p role="alert">
                            Der Katalog konnte nicht geladen werden.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setAttempt((value) => value + 1)
                            }
                        >
                            Erneut versuchen
                        </button>
                    </>
                )}
            </Modal>
        )
    }

    const choices = current.choices

    return (
        <ProfileImageContext.Provider
            value={supabaseProfileImageStore}
        >
            <CreateRankingEntryDialog
                list={list}
                catalogItems={choices.map(
                    (choice) => choice.value,
                )}
                onAddEntry={onNew}
                onAddExistingEntry={(id, position) => {
                    const source = choices.find(
                        (choice) => choice.value.id === id,
                    )

                    return source
                        ? onExisting(source, position)
                        : Promise.resolve(false)
                }}
                onClose={onClose}
            />
        </ProfileImageContext.Provider>
    )
}