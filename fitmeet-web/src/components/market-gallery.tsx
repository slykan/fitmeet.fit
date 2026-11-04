'use client'

import { useState } from 'react'

import { ImageLightbox, ImageSwiper } from '@/components/image-swiper'

/** Public listing page gallery: swipe/arrows on the cover, thumbnails below, tap to enlarge. */
export function MarketGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && (
        <ImageLightbox images={images} index={active} onIndexChange={setActive} onClose={() => setOpen(false)} alt={title} />
      )}
      <div style={{ background: 'var(--background)' }}>
        <ImageSwiper images={images} index={active} onIndexChange={setActive} alt={title} height={420} onTap={() => setOpen(true)} className="cursor-zoom-in" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className="shrink-0 rounded-lg overflow-hidden border-2 transition-colors"
              style={{ borderColor: i === active ? 'var(--primary)' : 'transparent' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${title} photo ${i + 1}`} className="h-20 w-28 object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </>
  )
}
