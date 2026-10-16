import { useEffect, useState } from 'react'
import { useProfileImageStore } from '../ProfileImageContext'
import type { ImageId } from '../../../shared/types/list.types'
import './ProfilePhoto.css'

export function ProfilePhoto({
    imageId,
    preview,
    name = '',
}: {
    imageId: ImageId | null
    preview?: Blob | null
    name?: string
}) {
    const store = useProfileImageStore()
    const [result, setResult] = useState<{ source: Blob | ImageId; url: string } | null>(null)
    const source = preview ?? imageId
    const url = result?.source === source ? result.url : null

    useEffect(() => {
        if (!source) return
        let active = true
        let objectUrl: string | null = null

        async function load() {
            try {
                const photo = source instanceof Blob ? source : await store.download(source as ImageId)
                if (!active) return
                objectUrl = URL.createObjectURL(photo)
                setResult({ source: source!, url: objectUrl })
            } catch {
                // A missing photo must never prevent opening or editing the list.
            }
        }
        void load()
        return () => {
            active = false
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [source, store])

    return (
        <span className="profile-photo" aria-hidden="true">
            {url
                ? <img src={url} alt="" draggable={false} />
                : <span>{name.trim().slice(0, 1).toLocaleUpperCase('de-CH') || '＋'}</span>}
        </span>
    )
}
