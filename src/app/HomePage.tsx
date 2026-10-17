interface HomePageProps {
    onOpenLists: () => void
    onOpenCatalog: () => void
}

export function HomePage({
                             onOpenLists,
                             onOpenCatalog,
                         }: HomePageProps) {
    return (
        <main className="page">
            <div className="page-heading">
                <h1>Dein Bereich</h1>
            </div>

            <nav className="feature-grid" aria-label="Bereiche">
                <button
                    type="button"
                    className="feature-card"
                    onClick={onOpenLists}
                >
                    <span
                        className="feature-card__icon"
                        aria-hidden="true"
                    >
                        ☷
                    </span>

                    <span>Listen</span>

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
                    onClick={onOpenCatalog}
                >
                    <span
                        className="feature-card__icon"
                        aria-hidden="true"
                    >
                        ♙
                    </span>

                    <span>Katalog</span>

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
                    disabled
                >
                    <span
                        className="feature-card__icon"
                        aria-hidden="true"
                    >
                        ▻
                    </span>

                    <span>Serien</span>
                    <span className="badge">Bald</span>
                </button>
            </nav>
        </main>
    )
}