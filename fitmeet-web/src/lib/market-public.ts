// Public marketplace data (no login): fetched at build time for /market and /market/item/[id],
// so the HTML already contains the listings; the /market page refreshes them in the browser.

export interface PublicListing {
  id: number
  type: 'sell' | 'buy'
  title: string
  description: string | null
  price: number
  currency: string
  condition: 'new' | 'used' | 'like_new' | null
  category: { value: string; label: string }
  status: string
  location: { city: string | null; country: string | null }
  images: string[]
  seller: { id: number; name: string; avatar: string | null }
  created_at: string
}

export const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'

export async function getPublicListings(limit = 60): Promise<PublicListing[]> {
  try {
    const res = await fetch(`${apiBase()}/market/public-latest?limit=${limit}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const payload = (await res.json()) as { data?: PublicListing[] }
    return payload.data ?? []
  } catch {
    return []
  }
}

export const CONDITION_LABEL: Record<string, string> = { new: 'New', used: 'Used', like_new: 'Like new' }

export function priceLabel(l: Pick<PublicListing, 'price' | 'type' | 'currency'>) {
  if (l.price <= 0) return l.type === 'buy' ? 'Wanted' : 'Price on request'
  return `${l.type === 'buy' ? 'up to ' : ''}${l.price.toFixed(0)} ${l.currency}`
}

export const place = (l: PublicListing) => [l.location.city, l.location.country].filter(Boolean).join(', ')
