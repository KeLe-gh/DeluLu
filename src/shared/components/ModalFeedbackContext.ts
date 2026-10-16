import { createContext } from 'react'
import type { ReactNode } from 'react'

interface ModalFeedback {
    busy: boolean
    blocked: boolean
    content: ReactNode
}

export const ModalFeedbackContext = createContext<ModalFeedback>({
    busy: false,
    blocked: false,
    content: null,
})