export function AppHeader({
                              onHome,
                              onBack,
                              onAdd,
                              addLabel = 'Liste erstellen',
                          }: {
    onHome: () => void
    onBack?: () => void
    onAdd?: () => void
    addLabel?: string
}) {
    return (
        <header className="app-bar">
            {onBack ? (
                <button
                    type="button"
                    className="icon-button"
                    aria-label="Zurück"
                    title="Zurück"
                    onClick={onBack}
                >
                    <span aria-hidden="true">←</span>
                </button>
            ) : (
                <span className="app-bar__spacer" />
            )}

            <button
                type="button"
                className="app-brand"
                aria-label="deluLu – Startseite"
                onClick={onHome}
            >
                deluLu <span aria-hidden="true">💜</span>
            </button>

            {onAdd ? (
                <button
                    type="button"
                    className="icon-button icon-button--add"
                    aria-label={addLabel}
                    title={addLabel}
                    onClick={onAdd}
                >
                    <span aria-hidden="true">+</span>
                </button>
            ) : (
                <span className="app-bar__spacer" />
            )}
        </header>
    )
}