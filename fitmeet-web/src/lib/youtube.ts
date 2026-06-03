export function getYouTubeVideoId(value: string): string | null {
  const input = normalizeYouTubeInput(value)
  if (!input) return null

  try {
    const url = new URL(input)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    const host = url.hostname.toLowerCase()
    const normalizedHost = host.replace(/^(www\.|m\.|music\.)/, '')

    if (normalizedHost === 'youtu.be') {
      return validVideoId(url.pathname.split('/').filter(Boolean)[0])
    }

    if (normalizedHost !== 'youtube.com' && normalizedHost !== 'youtube-nocookie.com') {
      return null
    }

    if (url.pathname === '/watch') {
      return validVideoId(url.searchParams.get('v'))
    }

    const [type, id] = url.pathname.split('/').filter(Boolean)
    if (['shorts', 'embed', 'live'].includes(type)) {
      return validVideoId(id)
    }
  } catch {
    return fallbackVideoId(input)
  }

  return fallbackVideoId(input)
}

export function isValidYouTubeUrl(value: string): boolean {
  return getYouTubeVideoId(value) !== null
}

function validVideoId(value: string | null | undefined): string | null {
  return value && /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null
}

function normalizeYouTubeInput(value: string): string {
  return value.trim().replace(/&amp;/g, '&').replace(/\s+/g, '')
}

function fallbackVideoId(value: string): string | null {
  const match = value.match(
    /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/i,
  )

  return validVideoId(match?.[1])
}
