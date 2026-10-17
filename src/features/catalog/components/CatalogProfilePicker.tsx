import {
    useContext,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react'
import { createPortal } from 'react-dom'
import { ModalFeedbackContext } from '../../../shared/components/ModalFeedbackContext'
import { ProfilePhoto } from '../../images/components/ProfilePhoto'
import '../../../shared/components/Modal.css'
import './CatalogProfilePicker.css'

type ProfileChoice = {
    id: string
    name: string
    profileImageId: string | null
}

function ProfileChoiceRow({
                              item,
                              selected,
                              onSelect,
                          }: {
    item: ProfileChoice
    selected: boolean
    onSelect: () => void
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
            { rootMargin: '80px' },
        )

        observer.observe(element.current)

        return () => observer.disconnect()
    }, [])

    return (
        <li ref={element}>
            <button
                type="button"
                className="catalog-picker__choice"
                aria-label={item.name}
                aria-pressed={selected}
                data-profile-choice={item.id}
                onClick={onSelect}
            >
                <ProfilePhoto
                    imageId={visible ? item.profileImageId : null}
                    name={item.name}
                />

                <span>{item.name}</span>

                {selected && (
                    <span
                        className="catalog-picker__check"
                        aria-hidden="true"
                    >
                        ✓
                    </span>
                )}
            </button>
        </li>
    )
}

function ProfilePickerDialog({
                                 items,
                                 value,
                                 disabled,
                                 onChoose,
                                 onClose,
                             }: {
    items: readonly ProfileChoice[]
    value: string
    disabled: boolean
    onChoose: (id: string) => void
    onClose: () => void
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    const titleId = useId()
    const searchId = useId()
    const [search, setSearch] = useState('')
    const feedback = useContext(ModalFeedbackContext)

    const blocked =
        disabled ||
        feedback.busy ||
        feedback.blocked

    const query = search.trim().toLocaleLowerCase('de-CH')

    const filtered = items
        .filter((item) =>
            item.name.toLocaleLowerCase('de-CH').includes(query),
        )
        .sort((a, b) =>
            a.name.localeCompare(b.name, 'de-CH'),
        )

    useEffect(() => {
        const element = dialog.current
        element?.showModal()

        return () => element?.close()
    }, [])

    return (
        <dialog
            ref={dialog}
            className="modal catalog-picker-dialog"
            aria-labelledby={titleId}
            aria-busy={feedback.busy}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()

                    if (!feedback.busy) {
                        onClose()
                    }
                }
            }}
            onCancel={(event) => {
                event.preventDefault()
                event.stopPropagation()

                if (!feedback.busy) {
                    onClose()
                }
            }}
        >
            <h2 id={titleId}>Profil auswählen</h2>

            <fieldset
                className="modal__fields"
                disabled={blocked}
            >
                <label
                    className="sr-only"
                    htmlFor={searchId}
                >
                    Profile suchen
                </label>

                <input
                    id={searchId}
                    type="search"
                    autoFocus
                    autoComplete="off"
                    placeholder="Suchen …"
                    value={search}
                    onChange={(event) =>
                        setSearch(event.target.value)
                    }
                />

                <ul
                    className="catalog-picker__results"
                    aria-label="Profile"
                >
                    {filtered.map((item) => (
                        <ProfileChoiceRow
                            key={item.id}
                            item={item}
                            selected={value === item.id}
                            onSelect={() => {
                                if (!blocked) {
                                    onChoose(item.id)
                                    onClose()
                                }
                            }}
                        />
                    ))}

                    {!filtered.length && (
                        <li className="catalog-picker__empty">
                            {items.length
                                ? 'Keine passenden Profile.'
                                : 'Keine weiteren Profile verfügbar.'}
                        </li>
                    )}
                </ul>
            </fieldset>

            <div className="modal__feedback">
                {feedback.content}
            </div>

            <button
                type="button"
                className="modal__cancel"
                disabled={feedback.busy}
                onClick={onClose}
            >
                Abbrechen
            </button>
        </dialog>
    )
}

export function CatalogProfilePicker({
                                         items,
                                         value,
                                         onChange,
                                         disabled = false,
                                     }: {
    items: readonly ProfileChoice[]
    value: string
    onChange: (id: string) => void
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const trigger = useRef<HTMLButtonElement>(null)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (!open && wasOpen.current) {
            trigger.current?.focus({ preventScroll: true })
        }

        wasOpen.current = open
    }, [open])

    const selected = items.find((item) => item.id === value)

    return (
        <div className="catalog-picker">
            <span>Profil</span>

            <button
                ref={trigger}
                type="button"
                className="catalog-picker__trigger"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={
                    selected
                        ? 'Profil ändern: ' + selected.name
                        : 'Profil auswählen'
                }
                disabled={disabled || !items.length}
                onClick={() => setOpen(true)}
            >
                {selected && (
                    <ProfilePhoto
                        imageId={selected.profileImageId}
                        name={selected.name}
                    />
                )}

                <span>
                    {selected?.name ?? 'Profil auswählen'}
                </span>

                <span aria-hidden="true">▾</span>
            </button>

            {!items.length && (
                <p className="field-hint">
                    Keine weiteren Profile verfügbar.
                </p>
            )}

            {open && createPortal(
                <ProfilePickerDialog
                    items={items}
                    value={value}
                    disabled={disabled}
                    onChoose={onChange}
                    onClose={() => setOpen(false)}
                />,
                document.body,
            )}
        </div>
    )
}