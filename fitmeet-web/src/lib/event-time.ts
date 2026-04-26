export const EVENT_TIME_ZONE = 'Europe/Zagreb'

function isValidTimeZone(timezone: string) {
  try {
    Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function resolveEventTimeZone(timezone?: string | null) {
  if (timezone && isValidTimeZone(timezone)) {
    return timezone
  }

  return EVENT_TIME_ZONE
}

function getFormatter(
  options: Intl.DateTimeFormatOptions,
  timezone = EVENT_TIME_ZONE,
  locale = 'en-GB',
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    ...options,
  })
}

function getTimeZoneOffsetMinutes(date: Date, timezone = EVENT_TIME_ZONE): number {
  const value = getFormatter(
    {
      hour: '2-digit',
      timeZoneName: 'shortOffset',
    },
    timezone,
    'en-US',
  )
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value

  if (!value || value === 'GMT') return 0

  const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number.parseInt(match[2], 10)
  const minutes = Number.parseInt(match[3] ?? '0', 10)

  return sign * (hours * 60 + minutes)
}

function getZonedParts(date: Date, timezone = EVENT_TIME_ZONE) {
  const parts = getFormatter({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }, timezone).formatToParts(date)

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>

  return map
}

export function formatEventDateTime(iso: string, timezone?: string | null) {
  const eventTimezone = resolveEventTimeZone(timezone)
  return getFormatter({
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }, eventTimezone).format(new Date(iso))
}

export function formatEventDateParts(iso: string, timezone?: string | null) {
  const eventTimezone = resolveEventTimeZone(timezone)
  const date = new Date(iso)

  return {
    day: getFormatter({
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }, eventTimezone).format(date),
    time: getFormatter({
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }, eventTimezone).format(date),
  }
}

export function eventUtcIsoToLocalInput(iso: string, timezone?: string | null) {
  const parts = getZonedParts(new Date(iso), resolveEventTimeZone(timezone))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function eventDateToLocalInput(date: Date, timezone?: string | null) {
  const parts = getZonedParts(date, resolveEventTimeZone(timezone))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function eventLocalInputToUtcIso(localDatetime: string, timezone?: string | null) {
  const eventTimezone = resolveEventTimeZone(timezone)
  const match = localDatetime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  )

  if (!match) {
    return new Date(localDatetime).toISOString()
  }

  const [, year, month, day, hour, minute] = match
  const utcGuess = Date.UTC(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    Number.parseInt(hour, 10),
    Number.parseInt(minute, 10),
  )

  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess), eventTimezone)
  return new Date(utcGuess - offsetMinutes * 60_000).toISOString()
}

export function eventWeatherSlot(startAt: string, timezone?: string | null) {
  const parts = getZonedParts(new Date(startAt), resolveEventTimeZone(timezone))
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number.parseInt(parts.hour, 10),
  }
}

export async function resolveTimeZoneFromCoords(
  lat: number,
  lng: number,
  fallback?: string | null,
) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&forecast_days=1&timezone=auto`,
      { cache: 'force-cache' },
    )

    if (!res.ok) {
      return resolveEventTimeZone(fallback)
    }

    const data = await res.json() as { timezone?: string }
    const timezone = data.timezone && data.timezone !== 'GMT'
      ? data.timezone
      : fallback

    return resolveEventTimeZone(timezone)
  } catch {
    return resolveEventTimeZone(fallback)
  }
}
