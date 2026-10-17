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

    const sections = [
        {
            label: 'Listen',
            icon: '☷',
            open: onOpenLists,
        },
        {
            label: 'Serien/Filme',
            icon: '▻',
            open: () => navigate('/media/watchlist'),
        },
        {
            label: 'Katalog',
            icon: '♙',
            open: onOpenCatalog,
        },
    ]

    return (
        <main className="page">
            <div className="page-heading">
                <h1>DeluLu is the SoluLu</h1>
            </div>

            <nav className="feature-grid" aria-label="Bereiche">
                {sections.map((section) => (
                    <button
                        key={section.label}
                        type="button"
                        className="feature-card"
                        onClick={section.open}
                    >
                        <span
                            className="feature-card__icon"
                            aria-hidden="true"
                        >
                            {section.icon}
                        </span>

                        <span>{section.label}</span>

                        <span
                            className="feature-card__arrow"
                            aria-hidden="true"
                        >
                            ›
                        </span>
                    </button>
                ))}
            </nav>
        </main>
    )
}