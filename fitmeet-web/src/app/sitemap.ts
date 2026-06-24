import type { MetadataRoute } from 'next'
import { posts } from '@/lib/posts'
import { getPublicShareEvents } from '@/app/events/share/share-seo'

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
    { url: siteUrl('/moments'),             lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: siteUrl('/moments/slideshow'),   lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: siteUrl('/ranks'),               lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: siteUrl('/supporters'),          lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: siteUrl('/about'),               lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: siteUrl('/contact'),             lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: siteUrl('/press'),               lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: siteUrl('/press/brand-details'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: siteUrl('/privacy'),             lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: siteUrl('/csae'),                lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: siteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const eventPages: MetadataRoute.Sitemap = (await getPublicShareEvents(20)).map((event) => ({
    url: siteUrl(`/events/share/${event.id}`),
    lastModified: new Date(event.created_at ?? event.schedule?.start_at ?? Date.now()),
    changeFrequency: 'daily',
    priority: 0.7,
  }))

  const marketPages: MetadataRoute.Sitemap = (await getPublicMarketListings(20)).map((listing) => ({
    url: `${siteUrl('/market/share')}?id=${listing.id}`,
    lastModified: new Date(listing.created_at ?? Date.now()),
    changeFrequency: listing.status === 'sold' ? 'monthly' : 'weekly',
    priority: listing.status === 'sold' ? 0.4 : 0.6,
  }))

  return [...staticPages, ...blogPages, ...eventPages, ...marketPages]
}
