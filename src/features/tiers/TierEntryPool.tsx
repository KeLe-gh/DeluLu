import type { CatalogItem } from '../catalog'
import type { TierListEntry } from '../../shared/types/list.types'
import { ProfilePhoto } from '../images/components/ProfilePhoto'

export function TierEntryPool({
                                  entries,
                                  items,
                              }: {
    entries: readonly TierListEntry[]
    items: readonly CatalogItem[]
}) {
    const profiles = new Map(
        items.map((item) => [item.id, item]),
    )

    const unassigned = entries.filter(
        (entry) => entry.tierId === null,
    )

    return (
        <ul
            className="tier-pool tier-pool--tiles"
            aria-label="Nicht zugeordnete Profile"
        >
            {unassigned.length === 0 && (
                <li className="tier-pool__empty">
                    Noch keine Einträge.
                </li>
            )}

            {unassigned.map((entry) => {
                const item = profiles.get(entry.itemId)

                return (
                    <li className="tier-tile" key={entry.id}>
                        <span
                            role="img"
                            aria-label={item?.name ?? 'Profil'}
                            title={item?.name}
                        >
                            <ProfilePhoto
                                imageId={item?.profileImageId ?? null}
                                name={item?.name}
                            />
                        </span>
                    </li>
                )
            })}
        </ul>
    )
}