import type { MetadataRoute } from 'next'
import { posts } from '@/lib/posts'
import { guides } from '@/lib/guides'
import { tools } from '@/lib/tools'

export const dynamic = 'force-static'

const BASE = 'https://fitmeet.fit'

function siteUrl(path = '') {
  if (!path) return `${BASE}/`
  return `${BASE}${path.endsWith('/') ? path : `${path}/`}`
}

type MarketListItem = {
  id: number
  created_at?: string | null
  status?: string | null
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'
}

async function getPublicMarketListings(limit = 20): Promise<MarketListItem[]> {
  try {
    const response = await fetch(`${apiBase()}/market/public-latest?limit=${limit}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })

    if (!response.ok) return []

    const payload = await response.json() as { data?: MarketListItem[] }
    return payload.data ?? []
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl(),                       lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: siteUrl('/blog'),                lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: siteUrl('/market'),              lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: siteUrl('/guides'),              lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: siteUrl('/tools'),               lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: siteUrl('/help'),                lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: siteUrl('/about'),               lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: siteUrl('/contact'),             lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: siteUrl('/press'),               lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: siteUrl('/press/brand-details'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: siteUrl('/privacy'),             lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: siteUrl('/help/huawei-health'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: siteUrl('/csae'),                lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: siteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  // Event and listing share pages are rendered in the browser (near-empty HTML) and are noindex:
  // only content pages go into the sitemap. Listings use the pre-rendered /market/item/<id>/ pages.
  const guidePages: MetadataRoute.Sitemap = guides.map((g) => ({
    url: siteUrl(`/guides/${g.slug}`),
    lastModified: new Date(g.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.9,
  }))

  const toolPages: MetadataRoute.Sitemap = tools.map((t) => ({
    url: siteUrl(`/tools/${t.slug}`),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const marketPages: MetadataRoute.Sitemap = (await getPublicMarketListings(60)).filter((l) => l.status !== 'sold').map((listing) => ({
    url: siteUrl(`/market/item/${listing.id}`),
    lastModified: new Date(listing.created_at ?? Date.now()),
    changeFrequency: listing.status === 'sold' ? 'monthly' : 'weekly',
    priority: listing.status === 'sold' ? 0.4 : 0.6,
  }))

  return [...staticPages, ...guidePages, ...toolPages, ...blogPages, ...marketPages]
}
