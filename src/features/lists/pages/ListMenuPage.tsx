interface ListMenuPageProps {
    onOpenRankings: () => void
    onOpenTiers: () => void
}

export function ListMenuPage({
                                 onOpenRankings,
                                 onOpenTiers,
                             }: ListMenuPageProps) {
    return (
        <main className="page">
            <div className="page-heading">
                <h1>Listen</h1>
            </div>

            <nav className="feature-grid" aria-label="Listenarten">
                <button
                    type="button"
                    className="feature-card"
                    onClick={onOpenRankings}
                >
                    <span
                        className="feature-card__icon"
                        aria-hidden="true"
                    >
                        1.
                    </span>

                    <span>Top-Listen</span>

                    <span
                        className="feature-card__arrow"
                        aria-hidden="true"
                    >
                        ›
                    </span>
                </button>

                <button
                    type="button"
                    className="feature-card"
                    onClick={onOpenTiers}
                >
                    <span
                        className="feature-card__icon"
                        aria-hidden="true"
                    >
                        ▤
                    </span>

                    <span>Tier-Listen</span>

                    <span
                        className="feature-card__arrow"
                        aria-hidden="true"
                    >
                        ›
                    </span>
                </button>
            </nav>
        </main>
    )
}