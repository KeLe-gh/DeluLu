import type { Versioned } from '../../shared/types/persistence.types'

export interface AppAppearance {
    backgroundImageId: string | null
}

export interface AppearanceRepository {
    load(): Promise<Versioned<AppAppearance> | null>

    save(
        appearance: AppAppearance,
        expectedRevision: number | null,
    ): Promise<Versioned<AppAppearance>>
}