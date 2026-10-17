import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '../../../shared/components/Modal'
import { createSoftBackdrop } from '../model/createSoftBackdrop'
import './BackgroundCropper.css'

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function BackgroundCropper({
                                      file,
                                      onConfirm,
                                      onCancel,
                                      aspectRatio = 4,
                                  }: {
    file: File
    onConfirm: (photo: Blob) => void
    onCancel: () => void
    aspectRatio?: number
}) {
    const zoomId = useId()

    const [loaded, setLoaded] = useState<{
        image: HTMLImageElement
        backdrop: HTMLCanvasElement
        backdropUrl: string
    } | null>(null)

    const image = loaded?.image ?? null

    const minimumZoom = image
        ? Math.max(
            0.01,
            Math.floor(
                Math.min(
                    1,
                    image.naturalWidth /
                    image.naturalHeight /
                    aspectRatio,
                    aspectRatio /
                    (image.naturalWidth / image.naturalHeight),
                ) * 100,
            ) / 100,
        )
        : 1

    const [zoom, setZoom] = useState(1)
    const [position, setPosition] = useState({ x: 0.5, y: 0.5 })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)

    const drag = useRef<{
        id: number
        clientX: number
        clientY: number
    } | null>(null)

    useEffect(() => {
        const url = URL.createObjectURL(file)
        const photo = new Image()
        let active = true

        photo.onload = () => {
            if (!active) return

            try {
                const backdrop = createSoftBackdrop(
                    photo,
                    aspectRatio,
                )

                setLoaded({
                    image: photo,
                    backdrop,
                    backdropUrl: backdrop.toDataURL(),
                })
            } catch {
                setError(
                    'Das Foto konnte nicht verarbeitet werden.',
                )
            }
        }

        photo.onerror = () => {
            if (active) {
                setError(
                    'Das Foto konnte nicht geöffnet werden. Bitte versuche ein JPEG oder PNG.',
                )
            }
        }

        photo.src = url

        return () => {
            active = false
            photo.src = ''
            URL.revokeObjectURL(url)
        }
    }, [file, aspectRatio])

    function moveBy(
        dx: number,
        dy: number,
        frame: HTMLDivElement,
    ) {
        if (!image) return

        const scale = Math.max(
            frame.clientWidth / image.naturalWidth,
            frame.clientHeight / image.naturalHeight,
        ) * zoom

        const overflowX =
            image.naturalWidth * scale - frame.clientWidth

        const overflowY =
            image.naturalHeight * scale - frame.clientHeight

        setPosition((current) => ({
            x: Math.abs(overflowX) > 0.5
                ? clamp(current.x - dx / overflowX)
                : 0.5,
            y: Math.abs(overflowY) > 0.5
                ? clamp(current.y - dy / overflowY)
                : 0.5,
        }))
    }

    async function confirm() {
        if (!loaded || savingRef.current) return

        const { image, backdrop } = loaded

        savingRef.current = true
        setSaving(true)
        setError('')

        try {
            const cropWidth = Math.min(
                image.naturalWidth,
                image.naturalHeight * aspectRatio,
            ) / zoom

            const cropHeight = cropWidth / aspectRatio
            const canvas = document.createElement('canvas')

            const outputScale = Math.min(
                1,
                1024 / Math.max(cropWidth, cropHeight),
            )

            canvas.width = Math.max(
                1,
                Math.round(cropWidth * outputScale),
            )

            canvas.height = Math.max(
                1,
                Math.round(cropHeight * outputScale),
            )

            const context = canvas.getContext('2d')

            if (!context) {
                throw new Error(
                    'Das Foto konnte nicht verarbeitet werden.',
                )
            }

            context.imageSmoothingEnabled = true
            context.imageSmoothingQuality = 'high'

            context.drawImage(
                backdrop,
                0,
                0,
                canvas.width,
                canvas.height,
            )

            const renderScale = canvas.width / cropWidth
            const width = image.naturalWidth * renderScale
            const height = image.naturalHeight * renderScale

            context.drawImage(
                image,
                (canvas.width - width) * position.x,
                (canvas.height - height) * position.y,
                width,
                height,
            )

            const photo = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, 'image/jpeg', 0.82)
            })

            if (!photo || photo.size > 2 * 1024 * 1024) {
                throw new Error(
                    'Der Ausschnitt konnte nicht gespeichert werden.',
                )
            }

            onConfirm(photo)
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Bitte versuche es erneut.',
            )
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }

    return createPortal(
        <Modal
            title="Hintergrund zuschneiden"
            busy={saving}
            onClose={onCancel}
        >
            <div className="background-cropper">
                <p>Foto verschieben und Zoom anpassen.</p>

                <div
                    className="background-cropper__frame"
                    style={{
                        aspectRatio,
                        width: `min(100%, ${50 * aspectRatio}svh)`,
                        marginInline: 'auto',
                    }}
                    role="group"
                    aria-label="Bildausschnitt, mit Pfeiltasten verschieben"
                    tabIndex={0}
                    onPointerDown={(event) => {
                        if (
                            !image ||
                            saving ||
                            drag.current ||
                            event.button !== 0
                        ) {
                            return
                        }

                        event.preventDefault()
                        event.currentTarget.focus()
                        event.currentTarget.setPointerCapture(
                            event.pointerId,
                        )

                        drag.current = {
                            id: event.pointerId,
                            clientX: event.clientX,
                            clientY: event.clientY,
                        }
                    }}
                    onPointerMove={(event) => {
                        const start = drag.current

                        if (
                            !start ||
                            start.id !== event.pointerId ||
                            saving
                        ) {
                            return
                        }

                        moveBy(
                            event.clientX - start.clientX,
                            event.clientY - start.clientY,
                            event.currentTarget,
                        )

                        start.clientX = event.clientX
                        start.clientY = event.clientY
                    }}
                    onPointerUp={() => {
                        drag.current = null
                    }}
                    onPointerCancel={() => {
                        drag.current = null
                    }}
                    onLostPointerCapture={() => {
                        drag.current = null
                    }}
                    onKeyDown={(event) => {
                        if (saving) return

                        const moves: Record<string, [number, number]> = {
                            ArrowLeft: [-10, 0],
                            ArrowRight: [10, 0],
                            ArrowUp: [0, -10],
                            ArrowDown: [0, 10],
                        }

                        const move = moves[event.key]
                        if (!move) return

                        event.preventDefault()
                        moveBy(...move, event.currentTarget)
                    }}
                >
                    {loaded && (
                        <span
                            className="background-cropper__backdrop"
                            aria-hidden="true"
                            style={{
                                backgroundImage:
                                    `url("${loaded.backdropUrl}")`,
                            }}
                        />
                    )}

                    {image && (
                        <img
                            src={image.src}
                            alt=""
                            draggable={false}
                            style={{
                                width: `${
                                    Math.max(
                                        1,
                                        image.naturalWidth /
                                        image.naturalHeight /
                                        aspectRatio,
                                    ) * zoom * 100
                                }%`,
                                left: `${position.x * 100}%`,
                                top: `${position.y * 100}%`,
                                transform: `translate(
                                    -${position.x * 100}%,
                                    -${position.y * 100}%
                                )`,
                            }}
                        />
                    )}
                </div>

                {!image && !error && (
                    <p role="status">Foto wird geöffnet …</p>
                )}

                <label htmlFor={zoomId}>Zoom</label>

                <input
                    id={zoomId}
                    type="range"
                    min={minimumZoom}
                    max="3"
                    step="0.01"
                    value={zoom}
                    disabled={!image || saving}
                    onChange={(event) => {
                        setZoom(Number(event.target.value))
                    }}
                />

                <button
                    type="button"
                    disabled={!image || saving}
                    onClick={() => {
                        setZoom(minimumZoom)
                        setPosition({ x: 0.5, y: 0.5 })
                    }}
                >
                    Gesamtes Foto
                </button>

                {error && <p role="alert">{error}</p>}

                <button
                    type="button"
                    disabled={!image || saving}
                    onClick={() => void confirm()}
                >
                    {saving ? 'Bitte warten …' : 'Ausschnitt übernehmen'}
                </button>
            </div>
        </Modal>,
        document.body,
    )
}