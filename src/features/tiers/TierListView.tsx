import type { ComponentProps } from 'react'
import { TierBoard } from './TierBoard'
import { HearMeOutCake } from './HearMeOutCake'

export function TierListView(
    props: ComponentProps<typeof TierBoard>,
) {
    if (props.list.styleId === 'cake') {
        return (
            <HearMeOutCake
                list={props.list}
                items={props.items}
            />
        )
    }

    return <TierBoard {...props} />
}