export type BadgeKey =
  | 'first_move'
  | 'organizer'
  | 'regular'
  | 'veteran'
  | 'club_10k'
  | 'club_50k'
  | 'century'
  | 'peak_bagger'
  | 'on_fire'
  | 'unstoppable'
  | 'connector'
  | 'host'
  | 'crowd_puller'
  | 'explorer'
  | 'early_bird'
  | 'night_owl'

export type BadgeDefinition = {
  key: BadgeKey
  emoji: string
  name: string
  description: string
}

// Mirrors app/Services/BadgeCatalog.php — keep in sync if badges change server-side.
export const BADGE_CATALOG: Record<BadgeKey, Omit<BadgeDefinition, 'key'>> = {
  first_move:   { emoji: '🎯', name: 'First Move',   description: 'Joined your first event.' },
  organizer:    { emoji: '🚀', name: 'Organizer',    description: 'Created your first event.' },
  regular:      { emoji: '🔥', name: 'Regular',      description: 'Joined 10 events.' },
  veteran:      { emoji: '👑', name: 'Veteran',      description: 'Joined 50 events.' },
  club_10k:     { emoji: '🥾', name: '10K Club',     description: 'Covered 10 km across your events.' },
  club_50k:     { emoji: '🏃', name: '50K Club',     description: 'Covered 50 km across your events.' },
  century:      { emoji: '🦵', name: 'Century',      description: 'Covered 100 km in a single event.' },
  peak_bagger:  { emoji: '⛰️', name: 'Peak Bagger',  description: 'Climbed 1000 m of total elevation.' },
  on_fire:      { emoji: '⚡', name: 'On Fire',      description: 'Active 2 weeks in a row.' },
  unstoppable:  { emoji: '💎', name: 'Unstoppable',  description: 'Active 4 weeks in a row.' },
  connector:    { emoji: '🤝', name: 'Connector',    description: 'Made 5 friends.' },
  host:         { emoji: '📣', name: 'Host',         description: 'Created 5 events.' },
  crowd_puller: { emoji: '🌟', name: 'Crowd Puller', description: 'One of your events reached 20+ participants.' },
  explorer:     { emoji: '🗺️', name: 'Explorer',     description: 'Tried 3 different activity categories.' },
  early_bird:   { emoji: '🌅', name: 'Early Bird',   description: 'Took part in an event starting before 7am.' },
  night_owl:    { emoji: '🌙', name: 'Night Owl',    description: 'Took part in an event starting after 9pm.' },
}

export function badgeDefinition(key: string): BadgeDefinition | null {
  const entry = BADGE_CATALOG[key as BadgeKey]
  return entry ? { key: key as BadgeKey, ...entry } : null
}
