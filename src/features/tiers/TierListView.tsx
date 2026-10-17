import type { ComponentProps } from 'react'
import { TierBoard } from './TierBoard'
import { SortableCake } from './SortableCake'

export function TierListView(props: ComponentProps<typeof TierBoard>) {
    return props.list.styleId === 'cake'
        ? <SortableCake {...props} />
        : <TierBoard {...props} />
}