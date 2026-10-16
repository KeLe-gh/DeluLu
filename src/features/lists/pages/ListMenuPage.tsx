interface ListMenuPageProps {
    onOpenRankings: () => void
}

export function ListMenuPage({ onOpenRankings }: ListMenuPageProps) {
    return (
        <main className="page">
            <div className="page-heading"><h1>Listen</h1></div>
            <nav className="feature-grid" aria-label="Listenarten">
                <button
                    type="button"
                    className="feature-card"
                    onClick={onOpenRankings}
                >
                    <span className="feature-card__icon" aria-hidden="true">1.</span>
                    <span>Top-Listen</span>
                    <span className="feature-card__arrow" aria-hidden="true">›</span>
                </button>
                <button type="button" className="feature-card" disabled>
                    <span className="feature-card__icon" aria-hidden="true">▤</span>
                    <span>Tier-Listen</span>
                    <span className="badge">Bald</span>
                </button>
            </nav>
        </main>
    )
}
