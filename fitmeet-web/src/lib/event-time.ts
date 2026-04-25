export const EVENT_TIME_ZONE = 'Europe/Zagreb'

function getFormatter(
  options: Intl.DateTimeFormatOptions,
  locale = 'en-GB',
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: EVENT_TIME_ZONE,
    ...options,
  })
}

function getTimeZoneOffsetMinutes(date: Date): number {
  const value = getFormatter(
    {
      hour: '2-digit',
      timeZoneName: 'shortOffset',
    },
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

function getZonedParts(date: Date) {
  const parts = getFormatter({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>

  return map
}

export function formatEventDateTime(iso: string) {
  return getFormatter({
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function formatEventDateParts(iso: string) {
  const date = new Date(iso)

  return {
    day: getFormatter({
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date),
    time: getFormatter({
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
  }
}

export function eventUtcIsoToLocalInput(iso: string) {
  const parts = getZonedParts(new Date(iso))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function eventDateToLocalInput(date: Date) {
  const parts = getZonedParts(date)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function eventLocalInputToUtcIso(localDatetime: string) {
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

  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(utcGuess))
  return new Date(utcGuess - offsetMinutes * 60_000).toISOString()
}

export function eventWeatherSlot(startAt: string) {
  const parts = getZonedParts(new Date(startAt))
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number.parseInt(parts.hour, 10),
  }
}
