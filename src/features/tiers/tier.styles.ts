export type TierStyleId = 'classic' | 'cake'

export interface TierStyle {
    id: TierStyleId
    name: string
    rows: readonly {
        label: string
        color: string
    }[]
}

export const tierStyles: readonly TierStyle[] = [
    {
        id: 'classic',
        name: 'Klassisch',
        rows: [
            { label: 'S', color: '#ff7f7f' },
            { label: 'A', color: '#ffbf7f' },
            { label: 'B', color: '#ffff7f' },
            { label: 'C', color: '#7fff7f' },
            { label: 'D', color: '#7fbfff' },
            { label: 'E', color: '#7f7fff' },
            { label: 'F', color: '#ff7fff' },
        ],
    },
    {
        id: 'cake',
        name: 'Hear me out cake',
        rows: [],
    },
]