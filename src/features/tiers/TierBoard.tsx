import type { Tier } from '../../shared/types/list.types'

export function TierBoard({
                              tiers,
                          }: {
    tiers: readonly Tier[]
}) {
    return (
        <div className="tier-board" aria-label="Tierliste">
            {tiers.map((tier) => (
                <div className="tier-board__row" key={tier.id}>
                    <span
                        className="tier-board__label"
                        style={{ background: tier.color }}
                    >
                        {tier.label}
                    </span>

                    <div
                        className="tier-board__items"
                        aria-label={'Tier ' + tier.label}
                    />
                </div>
            ))}
        </div>
    )
}