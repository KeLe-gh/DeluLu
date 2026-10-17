import { useAppNavigation } from './hooks/useAppNavigation'

interface HomePageProps {
    onOpenLists: () => void
    onOpenCatalog: () => void
}

export function HomePage({
                             onOpenLists,
                             onOpenCatalog,
                         }: HomePageProps) {
    const { navigate } = useAppNavigation()

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
                    onClick={() => navigate('/media/watchlist')}
                >
                    <span
                        className="feature-card__icon"
                        aria-hidden="true"
                    >
                        ▻
                    </span>

                    <span>Serien/Filme</span>

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