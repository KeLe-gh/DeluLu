const maxInputBytes = 30 * 1024 * 1024
const maxOutputBytes = 2 * 1024 * 1024
const maxDimension = 1024

export async function prepareProfilePhoto(file: File): Promise<Blob> {
    if (file.size === 0 || file.size > maxInputBytes) {
        throw new Error('Bitte wähle ein Foto mit höchstens 30 MB.')
    }
    if (file.type && !file.type.startsWith('image/')) {
        throw new Error('Bitte wähle ein Foto.')
    }

    const url = URL.createObjectURL(file)
    const image = new Image()

    try {
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error(
                'Das Foto konnte nicht geöffnet werden. Bitte versuche ein JPEG oder PNG.',
            ))
            image.src = url
        })

        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Das Foto konnte nicht verarbeitet werden.')

        // Re-encoding also leaves the original file's EXIF/location metadata behind.
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
        if (!photo || photo.size > maxOutputBytes) {
            throw new Error('Das Foto ist zu gross. Bitte wähle ein anderes.')
        }
        return photo
    } finally {
        image.src = ''
        URL.revokeObjectURL(url)
    }
}
