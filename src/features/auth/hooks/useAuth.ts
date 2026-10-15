import { useEffect, useState } from 'react'
import type {
    AuthService,
    AuthUser,
} from '../model/auth.types'

interface AuthState {
    user: AuthUser | null
    isLoading: boolean
}

export function useAuth(authService: AuthService): AuthState {
    const [state, setState] = useState<AuthState>({
        user: null,
        isLoading: true,
    })

    useEffect(() => {
        let active = true

        const unsubscribe = authService.subscribe((user) => {
            if (!active) {
                return
            }

            setState({
                user,
                isLoading: false,
            })
        })

        return () => {
            active = false
            unsubscribe()
        }
    }, [authService])

    return state
}