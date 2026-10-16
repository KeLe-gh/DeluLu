import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface SignUpPageProps {
    onSignUp: (email: string, password: string) => Promise<void>
    onOpenSignIn: () => void
}

export function SignUpPage({
                               onSignUp,
                               onOpenSignIn,
                           }: SignUpPageProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [hasSubmitted, setHasSubmitted] = useState(false)
    const [error, setError] = useState('')
    const submitting = useRef(false)

    async function signUp(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (submitting.current) return

        if (password !== confirmation) {
            setError('Die Passwörter stimmen nicht überein.')
            return
        }

        submitting.current = true
        setIsSubmitting(true)
        setError('')

        try {
            await onSignUp(email, password)
            setPassword('')
            setConfirmation('')
            setHasSubmitted(true)
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Registrierung fehlgeschlagen. Bitte versuche es erneut.',
            )
        } finally {
            submitting.current = false
            setIsSubmitting(false)
        }
    }

    if (hasSubmitted) {
        return (
            <main>
                <h1>Prüfe dein Postfach 💜</h1>

                <p role="status">
                    Bestätige deine E-Mail-Adresse über den Link
                    in der E-Mail. Schau auch im Spamordner nach.
                </p>

                <p>
                    Du hast bereits ein Konto?
                    Melde dich direkt an.
                </p>

                <button
                    type="button"
                    className="auth-switch"
                    onClick={onOpenSignIn}
                >
                    Zur Anmeldung
                </button>
            </main>
        )
    }

    return (
        <main>
            <h1>Willkommen bei deluLu 💜</h1>
            <p>Erstelle dein Konto für deine eigenen Listen.</p>

            <form onSubmit={signUp} aria-busy={isSubmitting}>
                <fieldset disabled={isSubmitting}>
                    <legend>Konto erstellen</legend>

                    <div>
                        <label htmlFor="sign-up-email">
                            E-Mail-Adresse
                        </label>

                        <input
                            id="sign-up-email"
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
                        <label htmlFor="sign-up-password">
                            Passwort
                        </label>

                        <input
                            id="sign-up-password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            aria-describedby="sign-up-password-hint"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            required
                        />

                        <p
                            id="sign-up-password-hint"
                            className="field-hint"
                        >
                            Mindestens 8 Zeichen.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="sign-up-confirmation">
                            Passwort wiederholen
                        </label>

                        <input
                            id="sign-up-confirmation"
                            name="passwordConfirmation"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            value={confirmation}
                            onChange={(event) =>
                                setConfirmation(event.target.value)
                            }
                            required
                        />
                    </div>

                    <button type="submit">
                        {isSubmitting
                            ? 'Konto wird erstellt …'
                            : 'Konto erstellen'}
                    </button>
                </fieldset>

                {error && <p role="alert">{error}</p>}
            </form>

            <button
                type="button"
                className="auth-switch"
                onClick={onOpenSignIn}
                disabled={isSubmitting}
            >
                Schon ein Konto? Anmelden
            </button>
        </main>
    )
}