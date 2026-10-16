import { useEffect, useState } from 'react'
import { useProfileImageStore } from '../ProfileImageContext'
import './BackgroundPhoto.css'

export function BackgroundPhoto({
                                    imageId,
                                    preview,
                                }: {
    imageId: string | null
    preview?: Blob | null
}) {
    const store = useProfileImageStore()
    const source = preview === undefined ? imageId : preview

    const [result, setResult] = useState<{
        source: string | Blob
        url: string
    } | null>(null)

    const url = result?.source === source ? result.url : null

    useEffect(() => {
        if (!source) return

        const currentSource = source
        let active = true
        let objectUrl: string | null = null

        async function load() {
            try {
                const photo = currentSource instanceof Blob
                    ? currentSource
                    : await store.download(currentSource)

                if (!active) return

                objectUrl = URL.createObjectURL(photo)
                setResult({
                    source: currentSource,
                    url: objectUrl,
                })
            } catch {
                // Keep the card usable if the photo is unavailable.
            }
        }

        void load()

        return () => {
            active = false
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [source, store])

    return (
        <span className="background-photo" aria-hidden="true">
            {url && <img src={url} alt="" draggable={false} />}
        </span>
    )
}