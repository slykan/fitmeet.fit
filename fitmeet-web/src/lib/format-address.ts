// Parse Nominatim addressdetails object → short formatted string
export function formatAddress(addr: Record<string, string>): string {
  const road   = addr.road || addr.pedestrian || addr.path || addr.footway || addr.street || ''
  const num    = addr.house_number || ''
  const street = num ? `${road} ${num}`.trim() : road

  const city    = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || ''
  const country = addr.country || ''

  return [street, city, country].filter(Boolean).join(', ')
}

// Parse a long Nominatim display_name string → short display (for legacy stored addresses)
export function shortAddress(full: string): string {
  if (!full) return ''
  const parts = full.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length <= 3) return full

  // Skip administrative noise
  const noise = /county|district|grad |četvrt|quarter|region|province|oblast|municipality/i
  const clean = parts.filter(p => !noise.test(p) && !/^\d{4,5}$/.test(p))

  // Street = first 1-2 clean parts, city = next, country = last
  const street  = clean.slice(0, 2).join(', ')
  const country = clean[clean.length - 1]
  const city    = clean.find((p, i) => i >= 2 && p !== country) ?? ''

  return [street, city && city !== country ? city : '', country]
    .filter(Boolean).join(', ')
}
