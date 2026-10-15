interface HomePageProps {
    onOpenLists: () => void
}

export function HomePage({ onOpenLists }: HomePageProps) {
    return (
        <main>
            <h1>deluLu 💜</h1>
            <p>Deine Listen. Deine Rankings. Deine Welt.</p>

            <nav aria-label="Bereiche">
                <div>
                    <button type="button" onClick={onOpenLists}>
                        Listen
                    </button>
                </div>

                <div>
                    <button type="button" disabled>
                        Serien – demnächst
                    </button>
                </div>

                <div>
                    <button type="button" disabled>
                        Einstellungen – demnächst
                    </button>
                </div>
            </nav>
        </main>
    )
}