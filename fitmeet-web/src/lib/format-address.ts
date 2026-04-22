// Parse Nominatim addressdetails object → short formatted string
export function formatAddress(addr: Record<string, string>): string {
  const road   = addr.road || addr.pedestrian || addr.path || addr.footway || addr.street || ''
  const num    = addr.house_number || ''
  const street = num ? `${road} ${num}`.trim() : road

  const city    = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || ''
  const country = addr.country || ''

  return [street, city, country].filter(Boolean).join(', ')
}

// Parse a long Nominatim display_name string → "Street Number, City, Country"
export function shortAddress(full: string): string {
  if (!full) return ''
  const parts = full.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length <= 2) return full

  // Noise: neighbourhoods, counties, postcodes
  const noise = /county|district|grad |četvrt|quarter|region|province|oblast|municipality|naselje|settlement/i
  const isPostcode = (s: string) => /^\d{4,6}$/.test(s)

  // Nominatim sometimes puts house number first
  let street: string
  let rest: string[]
  if (/^\d+[a-zA-Z]?$/.test(parts[0]) && parts.length > 1) {
    street = `${parts[1]} ${parts[0]}`   // "Ilirska ulica 25"
    rest   = parts.slice(2)
  } else {
    street = parts[0]
    rest   = parts.slice(1)
  }

  const clean   = rest.filter(p => !noise.test(p) && !isPostcode(p))
  const country = clean[clean.length - 1] ?? ''
  const city    = clean.find(p => p !== country) ?? ''

  return [street, city, country].filter(Boolean).join(', ')
}
