import type { ImageId } from '../../../shared/types/list.types'

// undefined keeps the current photo; null removes it; a Blob replaces it.
export type PhotoChange = Blob | null | undefined

export interface ProfileImageStore {
    upload(photo: Blob): Promise<ImageId>
    download(id: ImageId): Promise<Blob>
    cleanupUnused(): Promise<void>
}