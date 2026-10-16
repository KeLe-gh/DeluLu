import { createContext, useContext } from 'react'
import type { ProfileImageStore } from './model/profileImageStore'

export const ProfileImageContext = createContext<ProfileImageStore | null>(null)

export function useProfileImageStore(): ProfileImageStore {
    const store = useContext(ProfileImageContext)
    if (!store) throw new Error('ProfileImageContext is missing.')
    return store
}
