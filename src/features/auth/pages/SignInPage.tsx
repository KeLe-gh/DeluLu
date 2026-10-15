import { useState } from 'react'
import type { FormEvent } from 'react'

interface SignInPageProps {
    onSignIn: (email: string, password: string) => Promise<void>
}

export function SignInPage({ onSignIn }: SignInPageProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    async function signIn(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSubmitting) {
            return
        }

        setIsSubmitting(true)
        setError('')

        try {
            await onSignIn(email, password)
        } catch {
            setError(
                'Anmeldung fehlgeschlagen. Prüfe deine Zugangsdaten und versuche es erneut.',
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main>
            <h1>Willkommen bei deluLu</h1>
            <p>Melde dich an, um deine Listen zu öffnen.</p>

            <form onSubmit={signIn} aria-busy={isSubmitting}>
                <fieldset disabled={isSubmitting}>
                    <legend>Anmelden</legend>

                    <div>
                        <label htmlFor="sign-in-email">
                            E-Mail-Adresse
                        </label>

                        <input
                            id="sign-in-email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="sign-in-password">
                            Passwort
                        </label>

                        <input
                            id="sign-in-password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            required
                        />
                    </div>

                    <button type="submit">
                        {isSubmitting
                            ? 'Anmeldung läuft …'
                            : 'Anmelden'}
                    </button>
                </fieldset>

                {error && <p role="alert">{error}</p>}
            </form>
        </main>
    )
}