import type {
    ListId,
    RankingList,
} from '../../../shared/types/list.types'
import type {
    Versioned,
} from '../../../shared/types/persistence.types'

export interface RankingRepository {
    getAll(): Promise<Versioned<RankingList>[]>

    save(
        list: RankingList,
        expectedRevision: number | null,
    ): Promise<Versioned<RankingList>>

    remove(
        listId: ListId,
        expectedRevision: number,
    ): Promise<void>

    reorder(
        orderedLists: readonly Versioned<RankingList>[],
    ): Promise<void>
}