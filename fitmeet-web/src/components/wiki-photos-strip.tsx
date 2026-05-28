'use client'

import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'

interface WikiPhoto {
  title: string
  thumbUrl: string
  pageUrl: string
}

async function fetchWikiPhotos(lat: number, lng: number): Promise<WikiPhoto[]> {
  const base = 'https://commons.wikimedia.org/w/api.php'

  const geo = await fetch(
    `${base}?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=3000&gslimit=12&gsnamespace=6&format=json&origin=*`
  ).then(r => r.json())

  const items: Array<{ title: string }> = geo.query?.geosearch ?? []
  if (!items.length) return []

  const titles = items.map(i => encodeURIComponent(i.title)).join('|')
  const info = await fetch(
    `${base}?action=query&titles=${titles}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
  ).then(r => r.json())

  const pages = Object.values(info.query?.pages ?? {}) as Array<{
    title: string
    imageinfo?: Array<{ thumburl: string }>
  }>

  return pages
    .filter(p => p.imageinfo?.[0]?.thumburl)
    .map(p => ({
      title: p.title.replace('File:', '').replace(/_/g, ' ').replace(/\.[^.]+$/, ''),
      thumbUrl: p.imageinfo![0].thumburl,
      pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
    }))
    .slice(0, 8)
}

export function WikiPhotosStrip({ lat, lng }: { lat: number; lng: number }) {
  const [photos, setPhotos] = useState<WikiPhoto[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchWikiPhotos(lat, lng)
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [lat, lng])

  if (!loaded || photos.length < 2) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Camera size={14} style={{ color: 'var(--primary)' }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Along the route
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {photos.map((photo, i) => (
          <a
            key={i}
            href={photo.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 group relative overflow-hidden rounded-2xl block"
            style={{ width: 200, height: 140 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbUrl}
              alt={photo.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div
              className="absolute inset-x-0 bottom-0 px-2.5 py-2 text-[10px] font-medium truncate"
              style={{
                background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
                color: 'rgba(255,255,255,0.88)',
              }}
            >
              {photo.title}
            </div>
          </a>
        ))}
      </div>
      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
        Photos via Wikimedia Commons · CC licensed
      </p>
    </div>
  )
}
