import { useContext, useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { ModalFeedbackContext } from './ModalFeedbackContext'
import './Modal.css'

interface ModalProps {
    title: string
    busy?: boolean
    onClose: () => void
    children: ReactNode
}

export function Modal({
                          title,
                          busy = false,
                          onClose,
                          children,
                      }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const titleId = useId()
    const feedback = useContext(ModalFeedbackContext)
    const working = busy || feedback.busy

    useEffect(() => {
        const dialog = dialogRef.current

        if (!dialog) {
            return
        }

        dialog.showModal()

        return () => dialog.close()
    }, [])

    return (
        <dialog
            ref={dialogRef}
            className="modal"
            aria-labelledby={titleId}
            aria-busy={working}
            onCancel={(event) => {
                event.preventDefault()

                if (!working) {
                    onClose()
                }
            }}
        >
            <h2 id={titleId}>{title}</h2>

            <fieldset
                className="modal__fields"
                disabled={working || feedback.blocked}
            >
                {children}
            </fieldset>

            <div className="modal__feedback">
                {feedback.content}
            </div>

            <button
                type="button"
                className="modal__cancel"
                onClick={onClose}
                disabled={working}
            >
                Abbrechen
            </button>
        </dialog>
    )
}