import { useEffect, useRef, useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import { ModalFeedbackContext } from '../../shared/components/ModalFeedbackContext'
import { ProfilePhoto } from '../images/components/ProfilePhoto'
import type { ProfileImageStore } from '../images/model/profileImageStore'
import type { CatalogItem } from './model/catalog.types'
import type { CatalogManagerRepository } from './model/catalogManager.repository'
import { CatalogProfileDialog } from './components/CatalogProfileDialog'
import { useCatalogManager } from './hooks/useCatalogManager'
import './Catalog.css'

type SortOrder = 'name-asc' | 'name-desc' | 'newest' | 'oldest'

function CatalogCard({
                         item,
                         disabled,
                         onOpen,
                     }: {
    item: CatalogItem
    disabled: boolean
    onOpen: () => void
}) {
    const element = useRef<HTMLLIElement>(null)

    const [visible, setVisible] = useState(
        () => typeof IntersectionObserver === 'undefined',
    )

    useEffect(() => {
        if (
            !element.current ||
            typeof IntersectionObserver === 'undefined'
        ) {
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisible(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '200px' },
        )

        observer.observe(element.current)

        return () => observer.disconnect()
    }, [])

    return (
        <li ref={element}>
            <button
                type="button"
                className="catalog-card"
                disabled={disabled}
                aria-label={item.name + ' bearbeiten'}
                onClick={onOpen}
            >
                <ProfilePhoto
                    imageId={visible ? item.profileImageId : null}
                    name={item.name}
                />
                <span>{item.name}</span>
            </button>
        </li>
    )
}

export default function CatalogWorkspace({
                                             repository,
                                             imageStore,
                                             onNavigate,
                                             onBack,
                                         }: {
    repository: CatalogManagerRepository
    imageStore: ProfileImageStore
    onNavigate: (path: string) => void
    onBack: (path: string) => void
}) {
    const state = useCatalogManager(repository, imageStore)
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<SortOrder>('name-asc')
    const [selection, setSelection] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)

    const busy = state.isLoading || state.isSaving
    const blocked = busy || state.needsReload

    const selected = state.items.find(
        (record) => record.value.id === selection,
    )

    const needle = search.trim().toLocaleLowerCase('de-CH')

    const visible = state.items
        .map((record) => record.value)
        .filter((item) =>
            item.name.toLocaleLowerCase('de-CH').includes(needle),
        )
        .sort((a, b) => {
            const name =
                a.name.localeCompare(
                    b.name,
                    'de-CH',
                    { sensitivity: 'base' },
                ) ||
                a.id.localeCompare(b.id)

            if (sort === 'name-asc') return name
            if (sort === 'name-desc') return -name

            const date =
                Date.parse(a.createdAt) -
                Date.parse(b.createdAt)

            return (sort === 'newest' ? -date : date) || name
        })

    function close() {
        setCreating(false)
        setSelection(null)
    }

    const feedback = state.needsReload && !state.isLoading ? (
        <section className="app-feedback">
            <p role="alert">{state.error}</p>

            <button
                type="button"
                onClick={state.reload}
                disabled={busy}
            >
                Aktuellen Stand laden
            </button>
        </section>
    ) : null

    return (
        <ModalFeedbackContext.Provider
            value={{ busy, blocked, content: feedback }}
        >
            <div className="app-shell">
                <AppHeader
                    onHome={() => onNavigate('/')}
                    onBack={() => onBack('/')}
                    onAdd={
                        state.hasLoaded && !blocked
                            ? () => setCreating(true)
                            : undefined
                    }
                    addLabel="Profil hinzufügen"
                />

                <main className="page" aria-busy={busy}>
                    <div className="page-heading">
                        <h1>Katalog</h1>

                        <span className="count">
                            {needle ? visible.length + ' / ' : ''}
                            {state.items.length}
                        </span>
                    </div>

                    {feedback}

                    {state.isLoading && (
                        <p role="status">Katalog wird geladen …</p>
                    )}

                    {state.hasLoaded && (
                        <>
                            <div className="catalog-tools">
                                <label>
                                    <span className="sr-only">
                                        Profile suchen
                                    </span>

                                    <input
                                        type="search"
                                        placeholder="Suchen …"
                                        aria-label="Profile suchen"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                    />
                                </label>

                                <label>
                                    <span className="sr-only">
                                        Sortierung
                                    </span>

                                    <select
                                        aria-label="Sortierung"
                                        value={sort}
                                        onChange={(event) =>
                                            setSort(
                                                event.target.value as SortOrder,
                                            )
                                        }
                                    >
                                        <option value="name-asc">
                                            Name A–Z
                                        </option>
                                        <option value="name-desc">
                                            Name Z–A
                                        </option>
                                        <option value="newest">
                                            Neueste zuerst
                                        </option>
                                        <option value="oldest">
                                            Älteste zuerst
                                        </option>
                                    </select>
                                </label>
                            </div>

                            {visible.length ? (
                                <ul
                                    className="catalog-grid"
                                    aria-label="Profile"
                                >
                                    {visible.map((item) => (
                                        <CatalogCard
                                            key={item.id}
                                            item={item}
                                            disabled={blocked}
                                            onOpen={() =>
                                                setSelection(item.id)
                                            }
                                        />
                                    ))}
                                </ul>
                            ) : (
                                <p className="empty-state">
                                    {needle
                                        ? 'Keine passenden Profile.'
                                        : 'Noch keine Profile. Füge dein erstes über + hinzu.'}
                                </p>
                            )}
                        </>
                    )}
                </main>

                {(creating || selected) && (
                    <CatalogProfileDialog
                        key={creating ? 'new' : selected!.value.id}
                        item={selected?.value}
                        onSave={(draft) =>
                            state.save(draft, creating)
                        }
                        onRemove={() =>
                            selected
                                ? state.remove(selected.value.id)
                                : Promise.resolve(false)
                        }
                        onClose={close}
                    />
                )}
            </div>
        </ModalFeedbackContext.Provider>
    )
}