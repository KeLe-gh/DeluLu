import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from '../../app/AppHeader'
import { supabaseRankingSharing } from '../../infrastructure/supabase/supabaseRankingSharing'
import { supabaseTierSharing } from '../../infrastructure/supabase/supabaseTierSharing'
import SharedRankingDetail from './SharedRankingDetail'
import SharedTierDetail from './SharedTierDetail'
import './Sharing.css'

type Navigate = (path: string, replace?: boolean) => void

function useSharedRead<T>(read: () => Promise<T>) {
    const [attempt, setAttempt] = useState(0)
    const [result, setResult] = useState<{
        attempt: number
        data: T | null
        failed: boolean
    } | null>(null)

    const reload = useCallback(
        () => setAttempt((value) => value + 1),
        [],
    )

    useEffect(() => {
        let active = true

        void read().then(
            (data) => {
                if (active) {
                    setResult({ attempt, data, failed: false })
                }
            },
            () => {
                if (active) {
                    setResult({ attempt, data: null, failed: true })
                }
            },
        )

        return () => {
            active = false
        }
    }, [read, attempt])

    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === 'visible') reload()
        }

        window.addEventListener('focus', refresh)
        document.addEventListener('visibilitychange', refresh)

        return () => {
            window.removeEventListener('focus', refresh)
            document.removeEventListener('visibilitychange', refresh)
        }
    }, [reload])

    const current = result?.attempt === attempt ? result : null

    return {
        data: current?.data ?? null,
        failed: current?.failed ?? false,
        loading: !current,
        reload,
    }
}

async function readSharedLists() {
    const [rankings, tiers] = await Promise.all([
        supabaseRankingSharing.list(),
        supabaseTierSharing.list(),
    ])

    return [
        ...rankings.map((list) => ({
            ...list,
            type: 'Top-Liste',
            path: '/shared/' + list.id,
        })),
        ...tiers.map((list) => ({
            ...list,
            type: list.style_id === 'cake'
                ? 'Hear me out cake'
                : 'Tierliste',
            path: '/shared-tiers/' + list.id,
        })),
    ].sort((a, b) =>
        b.created_at.localeCompare(a.created_at) ||
        a.id.localeCompare(b.id),
    )
}

function SharedLists({ navigate }: { navigate: Navigate }) {
    const { data, failed, loading, reload } =
        useSharedRead(readSharedLists)

    return <main className="page">
        <h1>Geteilte Listen</h1>

        <div className="sharing-actions">
            <button
                className="sharing-button"
                type="button"
                disabled={loading}
                onClick={reload}
            >
                Aktualisieren
            </button>
        </div>

        {loading && <p role="status">Listen werden geladen …</p>}

        {failed && <p role="alert">
            Die Listen konnten nicht geladen werden.
            Bitte versuche es erneut.
        </p>}

        {data?.length === 0 && <div className="empty-state">
            <p>Noch keine geteilten Listen.</p>
            <p>Öffne einen Einladungslink, um beizutreten.</p>
        </div>}

        <div className="feature-grid">
            {data?.map((list) => <button
                type="button"
                className="feature-card"
                key={list.id}
                onClick={() => navigate(list.path)}
            >
                <span>
                    {list.title}
                    <small
                        className="field-hint"
                        style={{ display: 'block' }}
                    >
                        {list.type}
                    </small>
                </span>
                <span
                    className="feature-card__arrow"
                    aria-hidden="true"
                >
                    ›
                </span>
            </button>)}
        </div>
    </main>
}

function Invitation({
                        token,
                        navigate,
                        tier,
                    }: {
    token: string
    navigate: Navigate
    tier: boolean
}) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const working = useRef(false)

    async function join() {
        if (working.current) return

        working.current = true
        setBusy(true)
        setError('')

        try {
            const service = tier
                ? supabaseTierSharing
                : supabaseRankingSharing

            const id = await service.join(token)

            navigate(
                (tier ? '/shared-tiers/' : '/shared/') + id,
                true,
            )
        } catch {
            setError(
                'Beitreten fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut. Vielleicht ist der Link nicht mehr gültig.',
            )
        } finally {
            working.current = false
            setBusy(false)
        }
    }

    return <main className="page">
        <h1>Eine Liste für euch 💜</h1>
        <p>
            Du wurdest zu {
            tier
                ? 'einer Tierliste oder einem Cake'
                : 'einer Top-Liste'
        } eingeladen.
        </p>

        <div className="sharing-actions">
            <button
                type="button"
                className="sharing-button"
                disabled={busy}
                onClick={() => void join()}
            >
                {busy ? 'Beitritt läuft …' : 'Beitreten'}
            </button>
        </div>

        {error && <p role="alert">{error}</p>}
    </main>
}

export default function SharedRankingsWorkspace({
                                                    path,
                                                    onNavigate,
                                                    onBack,
                                                }: {
    path: string
    onNavigate: Navigate
    onBack: (parent: string) => void
}) {
    const tier = path.startsWith('/tier-share/')
    const token = path.match(
        /^\/(?:share|tier-share)\/([0-9a-f]{64})$/,
    )?.[1]
    const tierId = path.match(
        /^\/shared-tiers\/([0-9a-f-]{36})$/,
    )?.[1]
    const id = path.match(
        /^\/shared\/([0-9a-f-]{36})$/,
    )?.[1]

    return <div className="app-shell">
        {!id && !tierId && <AppHeader
            onHome={() => onNavigate('/')}
            onBack={() => onBack('/lists')}
        />}

        {path === '/shared' ? <SharedLists navigate={onNavigate} />
            : token ? <Invitation
                    key={token}
                    tier={tier}
                    token={token}
                    navigate={onNavigate}
                />
                : tierId ? <SharedTierDetail
                        key={tierId}
                        id={tierId}
                        navigate={onNavigate}
                        onBack={() => onBack('/shared')}
                    />
                    : id ? <SharedRankingDetail
                            key={id}
                            id={id}
                            navigate={onNavigate}
                            onBack={() => onBack('/shared')}
                        />
                        : <main className="page">
                            <h1>Link unvollständig</h1>
                            <p>
                                Bitte öffne den vollständigen Einladungslink.
                            </p>
                        </main>}
    </div>
}