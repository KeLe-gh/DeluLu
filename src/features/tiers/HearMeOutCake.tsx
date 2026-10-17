import type { CatalogItem } from '../catalog'
import type { TierList } from '../../shared/types/list.types'
import { ProfilePhoto } from '../images/components/ProfilePhoto'
import './HearMeOutCake.css'

export function CakeArtwork({
                                className,
                            }: {
    className?: string
}) {
    return (
        <svg
            className={className}
            viewBox="0 0 400 190"
            aria-hidden="true"
            focusable="false"
        >
            <ellipse
                cx="200"
                cy="168"
                rx="184"
                ry="16"
                fill="#26182b"
                opacity=".12"
            />

            <ellipse
                cx="200"
                cy="155"
                rx="180"
                ry="27"
                fill="#d9b77a"
            />

            <ellipse
                cx="200"
                cy="150"
                rx="172"
                ry="24"
                fill="#f1d7a0"
            />

            <path
                d="M42 54 C42 23 358 23 358 54 V128 C358 173 42 173 42 128Z"
                fill="#382924"
            />

            <path
                d="M44 91 C98 120 302 120 356 91"
                fill="none"
                stroke="#6b4b3b"
                strokeWidth="5"
                opacity=".7"
            />

            {Array.from({ length: 65 }, (_, i) => (
                <circle
                    key={i}
                    cx={54 + (i * 79) % 290}
                    cy={78 + (i * 31) % 63}
                    r={1 + (i % 3) * .55}
                    fill={i % 4 === 0 ? '#a58a75' : '#eee4d1'}
                />
            ))}

            <ellipse
                cx="200"
                cy="54"
                rx="158"
                ry="42"
                fill="#fbf2df"
                stroke="#d8c7ad"
                strokeWidth="2"
            />

            <path
                d="M45 54 C48 68 57 72 62 64 C68 59 74 82 83 72 C91 62 99 86 108 77 C119 65 126 88 137 79 C148 68 155 91 167 83 C180 73 187 92 200 85 C214 76 223 92 235 81 C248 71 256 89 267 77 C279 68 286 83 296 72 C307 63 314 77 324 65 C333 58 344 70 355 54"
                fill="none"
                stroke="#fff9ee"
                strokeWidth="9"
                strokeLinecap="round"
            />

            {Array.from({ length: 32 }, (_, i) => (
                <ellipse
                    key={i}
                    cx={79 + (i * 71) % 242}
                    cy={31 + (i * 19) % 34}
                    rx={2 + i % 3}
                    ry={1.3 + i % 2}
                    fill="#49342b"
                    transform={
                        'rotate(' + (i * 37) + ' ' +
                        (79 + (i * 71) % 242) + ' ' +
                        (31 + (i * 19) % 34) + ')'
                    }
                />
            ))}

            {[80, 127, 177, 227, 277, 324].map((x, i) => (
                <g
                    key={x}
                    transform={
                        'translate(' + x + ' ' +
                        (70 + Math.sin(i * .65) * 10) + ')'
                    }
                >
                    <path
                        d="M-13 0 Q-17-9-8-10 Q-10-20 0-17 Q8-24 11-13 Q22-10 15-2 Q16 7 5 6 Q-3 12-7 5 Q-16 7-13 0Z"
                        fill="#fffaf0"
                        stroke="#e0d0b8"
                        strokeWidth="1.5"
                    />

                    <path
                        d="M-7-1 Q-3-9 4-8 Q10-5 4 1 Q0 4-2 0"
                        fill="none"
                        stroke="#e6d9c4"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </g>
            ))}
        </svg>
    )
}

export function HearMeOutCake({
                                  list,
                                  items,
                              }: {
    list: TierList
    items: readonly CatalogItem[]
}) {
    const profiles = new Map(
        items.map((item) => [item.id, item]),
    )

    const rows = Math.max(
        1,
        Math.ceil(list.entries.length / 5),
    )

    const height = 340 + (rows - 1) * 86

    const pins = list.entries.map((entry, index) => {
        const row = Math.floor(index / 5)

        const count = Math.min(
            5,
            list.entries.length - row * 5,
        )

        const column = index % 5

        return {
            entry,
            item: profiles.get(entry.itemId),
            x: 200 + (column - (count - 1) / 2) * 68,
            y:
                height - 255 - row * 86 +
                (column % 2 ? -8 : 4),
            angle: [-7, 5, -3, 7, -5][column],
            row,
        }
    })

    return (
        <figure
            className="hear-me-out-cake"
            aria-label={
                'Hear me out cake mit ' +
                list.entries.length +
                ' Profilen'
            }
        >
            <div
                className="cake-stage"
                style={{ aspectRatio: '400 / ' + height }}
            >
                <div className="cake-base">
                    <CakeArtwork />
                </div>

                <svg
                    className="cake-sticks"
                    viewBox={'0 0 400 ' + height}
                    aria-hidden="true"
                    focusable="false"
                >
                    {pins.map((pin) => (
                        <g key={pin.entry.id}>
                            <line
                                x1={pin.x}
                                y1={pin.y + 48}
                                x2={pin.x * .82 + 36}
                                y2={
                                    height - 125 +
                                    (pin.row % 2) * 8
                                }
                                stroke="#ac8555"
                                strokeWidth="5"
                                strokeLinecap="round"
                            />

                            <line
                                x1={pin.x - 1}
                                y1={pin.y + 48}
                                x2={pin.x * .82 + 35}
                                y2={
                                    height - 126 +
                                    (pin.row % 2) * 8
                                }
                                stroke="#ecd0a0"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </g>
                    ))}
                </svg>

                {pins.map((pin) => (
                    <div
                        key={pin.entry.id}
                        className="cake-pin"
                        data-cake-entry={pin.entry.id}
                        role="img"
                        aria-label={pin.item?.name ?? 'Profil'}
                        title={pin.item?.name}
                        style={{
                            left: pin.x / 4 + '%',
                            top: pin.y / height * 100 + '%',
                            transform:
                                'translateX(-50%) rotate(' +
                                pin.angle + 'deg)',
                            zIndex: 10 + rows - pin.row,
                        }}
                    >
                        <ProfilePhoto
                            imageId={
                                pin.item?.profileImageId ?? null
                            }
                            name={pin.item?.name}
                        />
                    </div>
                ))}
            </div>
        </figure>
    )
}