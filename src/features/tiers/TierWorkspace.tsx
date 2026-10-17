import { useState } from 'react'
import type { CatalogRepository } from '../catalog'
import type { ProfileImageStore } from '../images/model/profileImageStore'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import { AppHeader } from '../../app/AppHeader'
import { TierListMenu } from './TierListMenu'
import { CreateTierListDialog } from './CreateTierListDialog'
import type { TierRepository } from './tier.repository'
import { useTierLists } from './useTierLists'
import SharedTierDetail from '../sharing/SharedTierDetail'
import './Tiers.css'

type Props = {
    repository: TierRepository
    catalogRepository: CatalogRepository
    imageStore: ProfileImageStore
    path: string
    onNavigate: (path: string) => void
    onBack: (path: string) => void
}

function Overview({
                      repository,
                      catalogRepository,
                      imageStore,
                      onNavigate,
                      onBack,
                  }: Props) {
    const state = useTierLists(
        repository,
        catalogRepository,
        imageStore,
    )

    const [createOpen, setCreateOpen] = useState(false)
    const busy = state.isLoading || state.isSaving
    const blocked = busy || state.needsReload

    const feedback = <>
        {busy && <p role="status">
            {state.isLoading
                ? 'Tierlisten werden geladen …'
                : 'Speichern …'}
        </p>}

        {state.error && <p role="alert">{state.error}</p>}

        {state.needsReload && !busy && <button
            type="button"
            onClick={state.reload}
        >
            Aktuellen Stand laden
        </button>}
    </>

    return <ModalFeedbackContext.Provider
        value={{ busy, blocked, content: feedback }}
    >
        <AppHeader
            onHome={() => onNavigate('/')}
            onBack={() => onBack('/lists')}
            onAdd={
                state.hasLoaded && !blocked
                    ? () => setCreateOpen(true)
                    : undefined
            }
            addLabel="Tierliste erstellen"
        />

        <main className="page" aria-busy={busy}>
            <div className="page-heading">
                <h1>Tierlisten</h1>
                <span className="count">{state.lists.length}</span>
            </div>

            <div className="sharing-actions">
                <button
                    type="button"
                    className="sharing-button"
                    onClick={() => onNavigate('/shared')}
                >
                    Geteilte Listen
                </button>
            </div>

            {feedback}

            {state.hasLoaded && (
                state.lists.length === 0
                    ? <div className="empty-state">
                        <p>Noch keine Tierlisten.</p>
                        <p>Erstelle deine erste über +.</p>
                    </div>
                    : <TierListMenu
                        lists={state.lists}
                        disabled={blocked}
                        onOpen={(id) => onNavigate(
                            '/tiers/' + encodeURIComponent(id),
                        )}
                        onRename={state.renameList}
                        onDelete={state.deleteList}
                    />
            )}
        </main>

        {createOpen && <CreateTierListDialog
            onClose={() => setCreateOpen(false)}
            onCreate={async (input) => {
                const id = await state.create(input)
                if (!id) return false

                setCreateOpen(false)
                onNavigate('/tiers/' + id)
                return true
            }}
        />}
    </ModalFeedbackContext.Provider>
}

export default function TierWorkspace(props: Props) {
    const id = props.path.match(
        /^\/tiers\/([0-9a-f-]{36})$/,
    )?.[1]

    return <div className="app-shell">
        {props.path === '/tiers' ? <Overview {...props} />
            : id ? <SharedTierDetail
                    key={id}
                    id={id}
                    navigate={props.onNavigate}
                    onBack={() => props.onBack('/tiers')}
                />
                : <>
                    <AppHeader
                        onHome={() => props.onNavigate('/')}
                        onBack={() => props.onBack('/tiers')}
                    />
                    <main className="page">
                        <h1>Nicht gefunden</h1>
                        <p>Diese Tierliste ist nicht verfügbar.</p>
                    </main>
                </>}
    </div>
}