import type { CatalogRepository } from './catalog.repository'
import type { PhotoChange } from '../../images/model/profileImageStore'

export interface CatalogManagerRepository extends CatalogRepository {
    remove(id: string, expectedRevision: number): Promise<void>
}

export interface CatalogProfileDraft {
    id: string
    name: string
    photo: PhotoChange
    background: PhotoChange
}