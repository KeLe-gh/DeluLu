export interface AuthUser {
    id: string
    email: string | null
}

export interface AuthService {
    // Reports the initial user and all subsequent changes.
    subscribe(
        onUserChange: (user: AuthUser | null) => void,
    ): () => void

    signIn(email: string, password: string): Promise<void>
    signUp(email: string, password: string, inviteToken: string): Promise<void>

    signOut(): Promise<void>
}