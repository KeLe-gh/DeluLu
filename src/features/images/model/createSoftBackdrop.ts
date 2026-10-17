export function createSoftBackdrop(
    image: HTMLImageElement,
    aspectRatio: number,
): HTMLCanvasElement {
    const canvas = document.createElement('canvas')

    canvas.width = aspectRatio >= 1
        ? 64
        : Math.max(1, Math.round(64 * aspectRatio))

    canvas.height = aspectRatio >= 1
        ? Math.max(1, Math.round(64 / aspectRatio))
        : 64

    const context = canvas.getContext('2d')

    if (!context) {
        throw new Error('Das Foto konnte nicht verarbeitet werden.')
    }

    const scale = Math.max(
        canvas.width / image.naturalWidth,
        canvas.height / image.naturalHeight,
    )

    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale

    context.fillStyle = '#342d40'
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.drawImage(
        image,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
    )

    // Blur a small bitmap without browser-specific canvas filters.
    const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
    )

    const result = new Uint8ClampedArray(pixels.data.length)
    const radius = 3

    for (let pass = 0; pass < 3; pass += 1) {
        for (const horizontal of [true, false]) {
            for (let y = 0; y < canvas.height; y += 1) {
                for (let x = 0; x < canvas.width; x += 1) {
                    const index = (y * canvas.width + x) * 4

                    for (let channel = 0; channel < 3; channel += 1) {
                        let total = 0

                        for (
                            let offset = -radius;
                            offset <= radius;
                            offset += 1
                        ) {
                            const sx = Math.max(
                                0,
                                Math.min(
                                    canvas.width - 1,
                                    x + (horizontal ? offset : 0),
                                ),
                            )

                            const sy = Math.max(
                                0,
                                Math.min(
                                    canvas.height - 1,
                                    y + (horizontal ? 0 : offset),
                                ),
                            )

                            total += pixels.data[
                            (sy * canvas.width + sx) * 4 + channel
                                ]
                        }

                        result[index + channel] =
                            total / (radius * 2 + 1)
                    }

                    result[index + 3] = 255
                }
            }

            pixels.data.set(result)
        }
    }

    context.putImageData(pixels, 0, 0)

    return canvas
}