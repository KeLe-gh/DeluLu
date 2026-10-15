interface ListMenuPageProps {
    onOpenRankings: () => void
}

export function ListMenuPage({
                                 onOpenRankings,
                             }: ListMenuPageProps) {
    return (
        <main>
            <h1>Listen</h1>
            <p>Welche Listen möchtest du öffnen?</p>

            <div>
                <button type="button" onClick={onOpenRankings}>
                    Top-Listen
                </button>
            </div>

            <div>
                <button type="button" disabled>
                    Tier-Listen – demnächst
                </button>
            </div>
        </main>
    )
}