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

    async signUp(email, password, inviteToken) {
        const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
                data: { invite_token: inviteToken },
                emailRedirectTo: window.location.origin + '/',
            },
        })

        if (error) {
            console.warn('[deluLu] Signup failed:', error)

            if (error.message.includes('gültigen Einladungslink')) {
                throw new Error(
                    'Dieser Einladungslink ist nicht mehr gültig.',
                )
            }

            if (
                error.code === 'over_email_send_rate_limit' ||
                error.code === 'over_request_rate_limit'
            ) {
                throw new Error(
                    'Bitte warte etwas und versuche es erneut.',
                )
            }

            if (error.code === 'weak_password') {
                throw new Error(
                    'Bitte wähle ein stärkeres Passwort.',
                )
            }

            throw new Error(
                'Registrierung fehlgeschlagen. Bitte versuche es erneut.',
            )
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