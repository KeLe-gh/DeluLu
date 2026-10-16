import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { AuthService } from '../model/auth.types'
import { SignInPage } from '../pages/SignInPage'

interface AuthGateProps {
    authService: AuthService
    children: ReactNode
}

export function AuthGate({
                             authService,
                             children,
                         }: AuthGateProps) {
    const { user, isLoading } = useAuth(authService)
    const [isSigningOut, setIsSigningOut] = useState(false)
    const [error, setError] = useState('')

    async function signOut() {
        if (isSigningOut) {
            return
        }

        setIsSigningOut(true)
        setError('')

        try {
            await authService.signOut()
        } catch {
            setError(
                'Abmelden fehlgeschlagen. Bitte versuche es erneut.',
            )
        } finally {
            setIsSigningOut(false)
        }
    }

    if (isLoading) {
        return (
            <main>
                <p role="status">Anmeldung wird geladen …</p>
            </main>
        )
    }

    if (user === null) {
        return (
            <SignInPage
                onSignIn={(email, password) =>
                    authService.signIn(email, password)
                }
            />
        )
    }

    return (
        <>


            <div key={user.id}>{children}</div>

            <footer className="account-footer">
                <details>
                    <summary>Konto</summary>
                <p>
                    {user.email
                        ? `Angemeldet als ${user.email}`
                        : 'Du bist angemeldet.'}
                </p>

                <button
                    type="button"
                    onClick={signOut}
                    disabled={isSigningOut}
                >
                    {isSigningOut
                        ? 'Abmeldung läuft …'
                        : 'Abmelden'}
                </button>

                {error && <p role="alert">{error}</p>}
                </details>
            </footer>
        </>
    )
}
