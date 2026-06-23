import { Download, FileText } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brand Details & Usage - FitMeet',
  description: 'FitMeet brand guidelines, logo usage, colors, typography, and voice guidance.',
}

const brandPages = Array.from({ length: 14 }, (_, index) => {
  const page = String(index + 1).padStart(2, '0')
  return {
    id: page,
    src: `/press/brand-book/pages/page${page}.html`,
  }
})

export default function BrandDetailsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-[#080808]">
        <section className="border-b border-white/10 bg-black">
          <div className="max-w-6xl mx-auto px-4 py-8 md:py-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-[--primary] mb-3">
                <FileText size={16} />
                Brand Details &amp; Usage
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-white">FitMeet Brand Guidelines</h1>
              <p className="mt-3 max-w-2xl text-sm md:text-base leading-relaxed text-zinc-400">
                Logo usage, colors, typography, iconography, voice, and digital application guidelines.
              </p>
            </div>
            <a
              href="/press/brand-book/print.html"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Download size={16} className="text-[--primary]" />
              Save as PDF
            </a>
          </div>
        </section>

        <section className="py-8 md:py-12">
          <div className="mx-auto max-w-[1160px] px-4">
            <div className="flex flex-col gap-8">
              {brandPages.map((page) => (
                <div key={page.id} className="w-full overflow-x-auto pb-2">
                  <iframe
                    src={page.src}
                    title={`FitMeet Brand Guidelines page ${page.id}`}
                    className="mx-auto block border-0 bg-white shadow-2xl"
                    style={{ width: 1080, height: 1527 }}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
