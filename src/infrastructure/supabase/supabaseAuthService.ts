import type { AuthService } from '../../features/auth/model/auth.types'
import { supabase } from './client'

export const supabaseAuthService: AuthService = {
    subscribe(onUserChange) {
        const { data } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                const user = session?.user

                onUserChange(
                    user
                        ? {
                            id: user.id,
                            email: user.email ?? null,
                        }
                        : null,
                )
            },
        )

        return () => {
            data.subscription.unsubscribe()
        }
    },

    async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        })

        if (error) {
            throw error
        }
    },

    async signOut() {
        const { error } = await supabase.auth.signOut({
            scope: 'local',
        })

        if (error) {
            throw error
        }
    },
}