import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { AuthService } from '../model/auth.types'
import { SignInPage } from '../pages/SignInPage'
import { SignUpPage } from '../pages/SignUpPage'
import { PushSettings } from '../../notifications/PushSettings'
import { disableDevicePush } from '../../notifications/pushDevice'

interface AuthGateProps {
    authService: AuthService
    path: string
    onNavigate: (path: string, replace?: boolean) => void
    children: ReactNode
    accountActions?: ReactNode
}

export function AuthGate({
                             authService,
                             path,
                             onNavigate,
                             children,
                             accountActions,
                         }: AuthGateProps) {
    const { user, isLoading } = useAuth(authService)
    const [isSigningOut, setIsSigningOut] = useState(false)
    const [error, setError] = useState('')

    const isJoinPage =
        path === '/join' || path.startsWith('/join/')

    const inviteToken =
        path.match(/^\/join\/([0-9a-f]{64})$/)?.[1]

    const openSignIn = () => onNavigate('/', true)

    async function signOut() {
        if (isSigningOut) return

        setIsSigningOut(true)
        setError('')

        try {
            await disableDevicePush()
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
                <p role="status">
                    Anmeldung wird geladen …
                </p>
            </main>
        )
    }

    if (user === null) {
        if (isJoinPage) {
            return inviteToken ? (
                <SignUpPage
                    key={inviteToken}
                    onSignUp={(email, password) =>
                        authService.signUp(
                            email,
                            password,
                            inviteToken,
                        )
                    }
                    onOpenSignIn={openSignIn}
                />
            ) : (
                <main>
                    <h1>Einladung unvollständig</h1>

                    <p>
                        Bitte öffne den vollständigen
                        Einladungslink.
                    </p>

                    <button
                        type="button"
                        className="auth-switch"
                        onClick={openSignIn}
                    >
                        Zur Anmeldung
                    </button>
                </main>
            )
        }

        return (
            <SignInPage
                onSignIn={(email, password) =>
                    authService.signIn(email, password)
                }
            />
        )
    }

    return (
        <Fragment key={user.id}>
            {isJoinPage ? (
                <main>
                    <h1>Du bist bereits angemeldet 💜</h1>

                    <p>
                        Öffne deine Listen oder melde dich unten
                        ab, um ein anderes Konto zu erstellen.
                    </p>

                    <button
                        type="button"
                        className="auth-switch"
                        onClick={openSignIn}
                    >
                        Zur App
                    </button>
                </main>
            ) : (
                <div key={user.id}>{children}</div>
            )}

            <footer className="account-footer">
                <details>
                    <summary>Konto</summary>

                    <p>
                        {user.email
                            ? `Angemeldet als ${user.email}`
                            : 'Du bist angemeldet.'}
                    </p>

                    {!isJoinPage && accountActions && (
                        <div style={{ marginBlock: '0.5rem' }}>
                            {accountActions}
                        </div>
                    )}

                    {!isJoinPage && (
                        <PushSettings
                            key={user.id}
                            userId={user.id}
                        />
                    )}

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
        </Fragment>
    )
}