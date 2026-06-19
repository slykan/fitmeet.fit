import { Download, Newspaper } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Press Kit — FitMeet',
  description: 'Download FitMeet logos, icons, and brand assets for press and media use.',
}

const logos = [
  { src: '/press/logo.png', label: 'Logo (Green on dark)', dark: false },
  { src: '/press/logo_black.png', label: 'Logo (Black)', dark: true },
  { src: '/press/logo_c.png', label: 'Logo icon (Green)', dark: false },
  { src: '/press/logo_full.png', label: 'Logo full', dark: false },
  { src: '/press/fitmeet_logo_transparent.png', label: 'Logo transparent (Green)', dark: false },
  { src: '/press/fitmeet_logo_transparent_black.png', label: 'Logo transparent (Black)', dark: true },
]

const icons = [
  { src: '/press/icon_1024.png', label: '1024×1024' },
  { src: '/press/icon_512.png', label: '512×512' },
  { src: '/press/icon_192.png', label: '192×192' },
  { src: '/press/icon_144.png', label: '144×144' },
  { src: '/press/icon_96.png', label: '96×96' },
  { src: '/press/icon_72.png', label: '72×72' },
  { src: '/press/icon_48.png', label: '48×48' },
]

const covers = [
  { src: '/press/cover1.png', label: 'Cover 1' },
  { src: '/press/cover2.png', label: 'Cover 2' },
  { src: '/press/cover3.png', label: 'Cover 3' },
]

const pdfs = [
  { href: '/press/fitmeet_logo_transparent.pdf', label: 'Logo (Green) — PDF' },
  { href: '/press/fitmeet_logo_transparent.black.pdf', label: 'Logo (Black) — PDF' },
]

export default function PressPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 md:py-20 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-3">
              <Newspaper size={18} style={{ color: 'var(--primary)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>Press Kit</p>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Brand &amp; Media Assets</h1>
            <p className="text-lg leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Download official FitMeet logos, icons, and cover images for press, media, and partnership use.
              Please do not alter the logos or use them in a misleading way.
            </p>
          </div>
        </section>

        {/* PDF Downloads */}
        <section className="py-12 md:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Vector Logos (PDF)</h2>
            <div className="flex flex-wrap gap-4">
              {pdfs.map((pdf) => (
                <a
                  key={pdf.href}
                  href={pdf.href}
                  download
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-medium transition-colors hover:bg-[--border]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <Download size={16} style={{ color: 'var(--primary)' }} />
                  {pdf.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Logos */}
        <section className="py-12 md:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Logos</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {logos.map((logo) => (
                <div key={logo.src} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div
                    className="flex items-center justify-center p-6"
                    style={{ background: logo.dark ? '#f4f4f5' : '#18181b', minHeight: 160 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo.src} alt={logo.label} className="max-h-24 max-w-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{logo.label}</span>
                    <a href={logo.src} download title="Download" className="p-1.5 rounded-lg hover:bg-[--border] transition-colors">
                      <Download size={15} style={{ color: 'var(--primary)' }} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* App Icons */}
        <section className="py-12 md:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">App Icons</h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {icons.map((icon) => (
                <div key={icon.src} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-center p-4" style={{ background: '#18181b', minHeight: 80 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon.src} alt={icon.label} className="max-h-12 max-w-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--surface)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{icon.label}</span>
                    <a href={icon.src} download title="Download" className="p-1 rounded hover:bg-[--border] transition-colors">
                      <Download size={13} style={{ color: 'var(--primary)' }} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Covers */}
        <section className="py-12 md:py-16">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Cover Images</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {covers.map((cover) => (
                <div key={cover.src} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="aspect-video overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cover.src} alt={cover.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{cover.label}</span>
                    <a href={cover.src} download title="Download" className="p-1.5 rounded-lg hover:bg-[--border] transition-colors">
                      <Download size={15} style={{ color: 'var(--primary)' }} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
